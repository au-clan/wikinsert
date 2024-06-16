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
from preprocessing import *
import subprocess
import json

def preprocess(text):
    processed_text = re.sub(r'\.\[', '. [', text)
    return processed_text

def parse(inpaths, outpaths):
    #run js_parsing/write_sentences.js using command, it can take all the paths at once
    command = ['node', 'js_parsing/parse.js'] + ['-i'] + inpaths + ['-o'] + outpaths
    subprocess.run(command, check=True)

def write_sentences_and_links(inpaths, outpaths):
    #run js_parsing/write_sentences.js using command, it can take all the paths at once
    command = ['node', 'js_parsing/write_sentences.js'] + ['-i'] + inpaths + ['-o'] + outpaths
    subprocess.run(command, check=True)    

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--revisions_path', type=str,
                        required=True, help='Path to the revision file')
    parser.add_argument('--html_dir', type=str, required=True,
                        help='Path to the directory containing all the parsed HTML files, both links and sentences')
    parser.add_argument('--first_versions_specific_html_dir', type=str, required=False,  default=None)
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')
    parser.add_argument('--first_versions_specific_output_dir', type=str, required=False, default=None,
                        help='Path to the output directory for the first versions')
    parser.add_argument('--first_version_only', type=bool, default=False,
                        help='If True, only the first version of the article will be processed')
    parser.add_argument('--lang', type=str, required=True,
                        help='Language code') 
    parser.add_argument('--n_processes', type=int, default=1,
                        help='Number of processes to use')

    args = parser.parse_args()
    
    lang = args.lang
    tokenizer = Tokenizer(language_code = lang)
    process_v2 = not args.first_version_only

    if args.first_versions_specific_html_dir is None:
        first_version_html_dir = args.html_dir
    else:
        first_version_html_dir = args.first_versions_specific_html_dir
    
    if args.first_versions_specific_output_dir is None:
        first_version_output_dir = args.output_dir
    else:
        first_version_output_dir = args.first_versions_specific_output_dir

    # check if input files exist
    if not os.path.exists(args.revisions_path):
        print(args.revisions_path)
        raise Exception('Revisions file does not exist')
    if not os.path.exists(args.html_dir):
        raise Exception(f'HTML directory {args.html_dir} does not exist')
    if not os.path.exists(first_version_html_dir):
        raise Exception(f'HTML directory {first_version_html_dir} does not exist')

    # create the output directory if it does not exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir, exist_ok=True)
    
    print(f"First version html dir: {first_version_html_dir}")
    if not os.path.exists(first_version_output_dir):
        os.makedirs(first_version_output_dir, exist_ok=True)

    revisions_clean = pd.read_parquet(args.revisions_path)

    all_paths_v1 = [f"{first_version_html_dir}/{row['source_ID']}_{row['first_version']}.html" for _, row in revisions_clean.iterrows()]
    outPaths_v1 = [f"{first_version_output_dir}/{row['source_ID']}_{row['first_version']}" for _ ,row in revisions_clean.iterrows()]
    
    nb_processes_ = min(cpu_count(), args.n_processes)

    batch_size_1 = math.ceil(len(all_paths_v1) / nb_processes_)


    batched_paths_1 = [all_paths_v1[i:i + batch_size_1] for i in range(0, len(all_paths_v1), batch_size_1)]
    batched_outPaths_1 = [outPaths_v1[i:i + batch_size_1] for i in range(0, len(outPaths_v1), batch_size_1)]
 

    print(f"Running on {nb_processes_} processes")
    print("Parallel multiprocess")
    start_time = time.time()
    print("Writing sentences and links v1")
    with Pool(processes=nb_processes_) as pool:
        pool.starmap(parse, zip(batched_paths_1, batched_outPaths_1))

    for path in tqdm(outPaths_v1, desc='Sentence tokenization'):
        path_filename = path + "_text.jsonl" 
        with open(os.path.join(first_version_html_dir, path_filename), 'r') as f:
            text = f.read()
        
        processed_text = preprocess(text)
        
        raw_sentences = list(tokenizer.sentence_tokenize(processed_text, use_abbreviation=True))
        
        out_filename = path + "_raw_sentences.jsonl"
        
        with open(out_filename, 'w') as f:
            f.writelines(json.dumps(item) + '\n' for item in raw_sentences)

    with Pool(processes=nb_processes_) as pool:
        pool.starmap(write_sentences_and_links, zip(batched_paths_1, batched_outPaths_1))

    end_time1 = time.time()
    print(f"Time taken for v1: {end_time1 - start_time}")
    
    if process_v2:
        all_paths_v2 = [f"{args.html_dir}/{row['source_ID']}_{version}.html" for _, row in revisions_clean.iterrows() for version in row['versions']]
        outPaths_v2 = [f"{args.output_dir}/{row['source_ID']}_{version}" for _ , row in revisions_clean.iterrows() for version in row['versions']]
        batch_size_2 = math.ceil(len(all_paths_v2) / nb_processes_)
        batched_paths_2 = [all_paths_v2[i:i + batch_size_2] for i in range(0, len(all_paths_v2), batch_size_2)]
        batched_outPaths_2 = [outPaths_v2[i:i + batch_size_2] for i in range(0, len(outPaths_v2), batch_size_2)]
        print("Writing sentences and links v2")

        with Pool(processes=nb_processes_) as pool:
            pool.starmap(parse, zip(batched_paths_1, batched_outPaths_1))

        for path in tqdm(outPaths_v2, desc='Sentence tokenization'):
            path_filename = path + "_text.jsonl" 
            with open(os.path.join(first_version_html_dir, path_filename), 'r') as f:
                text = f.read()
            
            processed_text = preprocess(text)
            
            raw_sentences = list(tokenizer.sentence_tokenize(processed_text, use_abbreviation=True))
            
            out_filename = path + "_raw_sentences.jsonl"
            
            with open(out_filename, 'w') as f:
                f.writelines(json.dumps(item) + '\n' for item in raw_sentences)

        with Pool(processes=nb_processes_) as pool:
            pool.starmap(write_sentences_and_links, zip(batched_paths_2, batched_outPaths_2))

    


    

    