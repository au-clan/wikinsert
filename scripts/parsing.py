"""
parsing.py

This script processes HTML files and extracts sentences from them, handling both first versions and revisions 
of articles.

Main Features:
- Preprocess text for formatting.
- Parse input files using a JavaScript parser.
- Tokenize sentences and save them in JSON format.
- Write sentences and links to specified output directories.

Usage:
Run the script with the following command:
    python parsing.py --revisions_path <path> --html_dir <path> --output_dir <path> --lang <language_code>

Required Arguments:
- --revisions_path: Path to the revision file.
- --html_dir: Directory of parsed HTML files.
- --output_dir: Directory for output results.
- --lang: Language code for processing.

Note: Ensure the required input files exist at the specified paths before execution.
"""
import pandas as pd
from mwtokenizer.tokenizer import Tokenizer
import regex as re
import argparse
import math
from tqdm import tqdm
import os
from multiprocessing import Pool, cpu_count
tqdm.pandas()
import time
from scripts.preprocessing import *
import subprocess
import json

def preprocess_text(text: str) -> str:
    """
    Preprocess the input text by replacing specific patterns. 
    Was found heuritically to improve tokenization. 

    Args:
        text (str): The input text to preprocess.

    Returns:
        str: The processed text with specified patterns replaced.
    """
    processed_text = text
    processed_text = re.sub(r'\.\[', '. [', processed_text)
    processed_text = re.sub(r'\.\<', '. <', processed_text)
    processed_text = re.sub(r'\.\n', '. \n', processed_text)
    
    return processed_text

def parse(inpaths: List[str], outpaths: List[str]) -> None:
    """
    Run a JavaScript parsing command to run the first step of parsing of html files.
    (text & section extraction before sentence tokenization)

    Args:
        inpaths (List[str]): A list of input file paths.
        outpaths (List[str]): A list of output file paths.
    
    Raises:
        subprocess.CalledProcessError: If the command fails.
    """
    command = ['node', 'js_parsing/parse.js'] + ['-i'] + inpaths + ['-o'] + outpaths
    subprocess.run(command, check=True)

def sentence_tokenize(outpaths: List[str], tokenizer: Callable[[str, bool], List[str]]) -> None:
    """
    Tokenize text into sentences from output paths and save the results.

    Args:
        outpaths (List[str]): A list of output file paths.
        tokenizer (Callable[[str, bool], List[str]]): A tokenizer function that takes a string and a boolean flag.
    
    Returns:
        None
    """
    for path in tqdm(outpaths, desc='Sentence tokenization'):
        path_filename = path + "_text.jsonl"
        with open(os.path.join(first_version_html_dir, path_filename), 'r', encoding='utf-8') as f:
            text = f.read()
        
        processed_text = preprocess_text(text)

        # First splitting when there are 2 or more \n in a row
        pattern = r'(\n<<C\d{2}>><<O\d{2}>>\n)'
        splits = re.split(pattern, processed_text)
        processed_texts = [splits[i] + splits[i + 1] for i in range(0, len(splits) - 1, 2)]

        if len(splits) % 2 != 0:
            processed_texts.append(splits[-1])
        else:
            processed_texts.append(splits[-2] + splits[-1])

        raw_sentences_lists = [list(tokenizer.sentence_tokenize(processed_text_part, use_abbreviation=True)) for processed_text_part in processed_texts]
        raw_sentences = [sentence for sentence_list in raw_sentences_lists for sentence in sentence_list]
        raw_sentences = [s.strip() for s in raw_sentences]
        out_filename = path + "_raw_sentences.jsonl"
        
        with open(out_filename, 'w', encoding='utf-8') as f:
            json.dump(raw_sentences, f)

def write_sentences_and_links(inpaths: List[str], outpaths: List[str]) -> None:
    """
    Run a JavaScript command to write sentences and links to output files.
    This is the sedonc part of parsing, after the tokenization into sentences.
    It includes the string indices retrieving. 

    Args:
        inpaths (List[str]): A list of input file paths.
        outpaths (List[str]): A list of output file paths.

    Raises:
        subprocess.CalledProcessError: If the command fails.
    """
    command = ['node', 'js_parsing/write_sentences.js'] + ['-i'] + inpaths + ['-o'] + outpaths
    subprocess.run(command, check=True)    

if __name__ == '__main__':
    # Initialize argument parser
    parser = argparse.ArgumentParser()
    
    # Add arguments for the script
    parser.add_argument('--revisions_path', type=str,
                        required=True, help='Path to the revision file')
    parser.add_argument('--html_dir', type=str, required=True,
                        help='Path to the directory containing all the parsed HTML files, both links and sentences')
    parser.add_argument('--first_versions_specific_html_dir', type=str, required=False,  default=None,
                        help='Optional path to the directory for first versions of HTML files')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory for results')
    parser.add_argument('--first_versions_specific_output_dir', type=str, required=False, default=None,
                        help='Optional path to the output directory for the first versions')
    parser.add_argument('--first_version_only', type=bool, default=False,
                        help='If True, only the first version of the article will be processed')
    parser.add_argument('--lang', type=str, required=True,
                        help='Language code to specify the language of the content')
    parser.add_argument('--n_processes', type=int, default=1,
                        help='Number of processes to use for parallel processing')

    # Parse the arguments
    args = parser.parse_args()
    
    # Set the language and initialize the tokenizer
    lang = args.lang
    tokenizer = Tokenizer(language_code=lang)
    process_v2 = not args.first_version_only  # Flag to indicate if processing version 2

    # Determine HTML directories based on input arguments
    first_version_html_dir = args.first_versions_specific_html_dir or args.html_dir
    first_version_output_dir = args.first_versions_specific_output_dir or args.output_dir

    # Check if input files exist; raise exceptions if not
    if not os.path.exists(args.revisions_path):
        print(args.revisions_path)
        raise Exception('Revisions file does not exist')
    if not os.path.exists(args.html_dir):
        raise Exception(f'HTML directory {args.html_dir} does not exist')
    if not os.path.exists(first_version_html_dir):
        raise Exception(f'HTML directory {first_version_html_dir} does not exist')

    # Create the output directory if it does not exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir, exist_ok=True)
    
    # Print the first version HTML directory being used
    print(f"First version html dir: {first_version_html_dir}")
    if not os.path.exists(first_version_output_dir):
        os.makedirs(first_version_output_dir)  # Create the output directory for first versions

    # Load the revisions data
    revisions_clean = pd.read_parquet(args.revisions_path)

    # Prepare lists of input and output file paths for the first version
    all_paths_v1 = [f"{first_version_html_dir}/{row['source_ID']}_{row['first_version']}.html" for _, row in revisions_clean.iterrows()]
    outPaths_v1 = [f"{first_version_output_dir}/{row['source_ID']}_{row['first_version']}" for _, row in revisions_clean.iterrows()]
    
    # Determine the number of processes to use, ensuring it doesn't exceed the number of available CPUs
    nb_processes_ = min(cpu_count(), args.n_processes)

    # Calculate batch size for processing
    batch_size_1 = math.ceil(len(all_paths_v1) / nb_processes_)

    # Create batches of input and output paths for the first version
    batched_paths_1 = [all_paths_v1[i:i + batch_size_1] for i in range(0, len(all_paths_v1), batch_size_1)]
    batched_outPaths_1 = [outPaths_v1[i:i + batch_size_1] for i in range(0, len(outPaths_v1), batch_size_1)]
 
    # Print information about the processes being run
    print(f"Running on {nb_processes_} processes")
    print("Parallel multiprocess")
    start_time = time.time()
    
    # Process the first version: write sentences and links
    print("Writing sentences and links v1")
    with Pool(processes=nb_processes_) as pool:
        pool.starmap(parse, zip(batched_paths_1, batched_outPaths_1))

    # Tokenize sentences for the first version
    sentence_tokenize(outPaths_v1, tokenizer)

    # Write sentences and links for the first version
    with Pool(processes=nb_processes_) as pool:
        pool.starmap(write_sentences_and_links, zip(batched_paths_1, batched_outPaths_1))

    end_time1 = time.time()
    print(f"Time taken for v1: {end_time1 - start_time}")
    
    # If processing the second version is enabled
    if process_v2:
        # Prepare lists of input and output file paths for all versions
        all_paths_v2 = [f"{args.html_dir}/{row['source_ID']}_{version}.html" for _, row in revisions_clean.iterrows() for version in row['versions']]
        outPaths_v2 = [f"{args.output_dir}/{row['source_ID']}_{version}" for _, row in revisions_clean.iterrows() for version in row['versions']]
        
        # Calculate batch size for processing the second version
        batch_size_2 = math.ceil(len(all_paths_v2) / nb_processes_)
        
        # Create batches of input and output paths for the second version
        batched_paths_2 = [all_paths_v2[i:i + batch_size_2] for i in range(0, len(all_paths_v2), batch_size_2)]
        batched_outPaths_2 = [outPaths_v2[i:i + batch_size_2] for i in range(0, len(outPaths_v2), batch_size_2)]
        
        # Process the second version: write sentences and links
        print("Writing sentences and links v2")
        with Pool(processes=nb_processes_) as pool:
            pool.starmap(parse, zip(batched_paths_2, batched_outPaths_2))

        # Tokenize sentences for the second version
        sentence_tokenize(outPaths_v2, tokenizer)

        # Write sentences and links for the second version
        with Pool(processes=nb_processes_) as pool:
            pool.starmap(write_sentences_and_links, zip(batched_paths_2, batched_outPaths_2))

    


    

    