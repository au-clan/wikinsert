"""
Crawl web pages using a revisions file with options for parallel processing and 
second versions.

Features:
- Validates input files and creates the output directory.
- Extracts IDs and titles from the revisions file.
- Runs crawlers in parallel.
- Moves crawled files to the correct locations.

Usage:
    python script_name.py --revisions_path path/to/revisions.parquet 
                           --output_dir path/to/output 
                           --n_processes 4 
                           --lang en 
                           --crawl_second_versions True

Arguments:
    --revisions_path (str): Path to the revisions file (required).
    --output_dir (str): Path for output files (required).
    --n_processes (int): Number of processes (default: 1).
    --lang (str): Language of the pages (required).
    --crawl_second_versions (bool): Crawl second versions (default: False).
"""

import pandas as pd
import argparse
import math
from tqdm import tqdm
import os
from multiprocessing import Pool, cpu_count
tqdm.pandas()
import time
from scripts.preprocessing import *
import subprocess


def call_crawler(titles: List[str], curids: List[str], oldids: List[str], outfolder: str, lang: str) -> None:
    """
    Executes the crawler script for each title, current ID, and old ID.

    Args:
        titles (List[str]): A list of titles to crawl.
        curids (List[str]): A list of current IDs corresponding to each title.
        oldids (List[str]): A list of old IDs corresponding to each title.
        outfolder (str): The output folder where the results will be stored.
        lang (str): The language parameter for the crawler.

    Raises:
        subprocess.CalledProcessError: If the command to run the crawler fails.
    """
    # Run js_crawler/crawl_full_pages.js for each title, current ID, and old ID
    for title, curid, oldid in zip(titles, curids, oldids):
        command = [
            'node', 
            'js_crawler/crawl_full_pages.js', 
            '-l', lang, 
            '-p', outfolder, 
            '-t', title, 
            '-c', curid, 
            '-o', oldid
        ]
        # Execute the command and check for errors
        subprocess.run(command, check=True)

def move_file(current_path: str, new_path: str) -> None:
    """
    Moves a file from the current path to the new path.

    Args:
        current_path (str): The current path of the file to be moved.
        new_path (str): The new path where the file will be moved.
    """
    os.rename(current_path, new_path)

def move_single_page_files(crawled_files_name: List[str], curid_oldid: str, crawling_outdir: str) -> None:
    """
    Moves individual crawled page files to their designated locations.

    Args:
        crawled_files_name (List[str]): A list of names of crawled files.
        curid_oldid (str): The current ID or old ID used for naming.
        crawling_outdir (str): The output directory where files will be moved to.
    """
    index_file_path = f"{crawling_outdir}/{curid_oldid}"

    for crawled_file in crawled_files_name:
        file_path = f"{index_file_path}/{crawled_file}"
        # Rename index.html to curid_oldid.html
        if crawled_file == "index.html":
            move_file(file_path, f"{crawling_outdir}/{curid_oldid}.html")

def move_all_pages_files(crawled_pages_dirs: List[str], crawling_outdir: str) -> None:
    """
    Moves all crawled page files from their respective directories to the output directory.

    Args:
        crawled_pages_dirs (List[str]): A list of directories containing crawled pages.
        crawling_outdir (str): The output directory where files will be moved to.
    """
    # Iterate through the list of crawled page directories
    for crawled_page_dir in tqdm(crawled_pages_dirs, desc='Moving files'):
        page_dir = f"{crawling_outdir}/{crawled_page_dir}"
        page_files_name = list(os.listdir(page_dir))  # List all files in the directory
        move_single_page_files(page_files_name, crawled_page_dir, crawling_outdir)

if __name__ == '__main__':
    # Set up argument parser to handle command line inputs
    parser = argparse.ArgumentParser()
    
    # Argument for the path to the revisions file
    parser.add_argument('--revisions_path', type=str,
                        required=True, help='Path to the revision file')
    
    # Argument for the output directory where results will be saved
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')
    
    # Argument to specify the number of processes for parallel execution
    parser.add_argument('--n_processes', type=int, default=1,
                        help='Number of processes to use')
    
    # Argument to specify the language of the pages to be crawled
    parser.add_argument('--lang', type=str, required=True,
                        help='Language of the pages')
    
    # Argument to decide whether to crawl second versions of pages
    parser.add_argument('--crawl_second_versions', type=bool, required=False, default=False,
                        help='Whether to crawl the second versions')

    # Parse the command line arguments
    args = parser.parse_args()

    # Check if the revisions file exists; raise an exception if not
    if not os.path.exists(args.revisions_path):
        print(args.revisions_path)
        raise Exception('Revisions file does not exist')
   
    # Create the output directory if it does not already exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
    
    # Read the revisions file into a DataFrame
    revisions_clean = pd.read_parquet(args.revisions_path)

    # Extract current IDs, old IDs, and titles from the DataFrame
    curids = [str(row['source_ID']) for _, row in revisions_clean.iterrows()]
    oldids = [str(row['first_version']) for _, row in revisions_clean.iterrows()]
    titles = [row['source_title'] for _, row in revisions_clean.iterrows()]

    # If crawling second versions is enabled, extend the lists with additional IDs and titles
    if args.crawl_second_versions:
        print("Crawling second versions...")
        curids += [str(row['source_ID']) for _, row in revisions_clean.iterrows() for _ in row['versions']]
        oldids += [str(version) for _, row in revisions_clean.iterrows() for version in row['versions']]
        titles += [row['source_title'] for _, row in revisions_clean.iterrows() for _ in row['versions']]

    # Display the total number of pages to be crawled
    print(f"Total number of pages to crawl: {len(curids)}")

    # Determine the number of processes to use for crawling
    nb_processes_ = min(cpu_count(), args.n_processes)

    # Calculate the batch size based on the number of current IDs and processes
    batch_size_1 = math.ceil(len(curids) / nb_processes_)

    # Create batches of current IDs, old IDs, and titles for processing
    batched_curids = [curids[i:i + batch_size_1] for i in range(0, len(curids), batch_size_1)]
    batched_oldids = [oldids[i:i + batch_size_1] for i in range(0, len(oldids), batch_size_1)]
    batched_titles = [titles[i:i + batch_size_1] for i in range(0, len(titles), batch_size_1)]

    # Log the number of processes being used for crawling
    print(f"Running crawling on {nb_processes_} processes")
    start_time = time.time()  # Record the start time for performance measurement

    # Use multiprocessing to call the crawler in parallel for each batch
    with Pool(processes=nb_processes_) as pool:
        pool.starmap(call_crawler, zip(batched_titles, batched_curids, batched_oldids, 
                                         [args.output_dir]*len(batched_titles), 
                                         [args.lang]*len(batched_titles)))

    end_time = time.time()  # Record the end time
    duration_in_minutes = (end_time - start_time) / 60  # Calculate the duration in minutes
    print(f"Crawling finished in {duration_in_minutes} minutes, post processing...")

    # Move all crawled files to their correct locations
    all_crawled_pages = list(os.listdir(args.output_dir))
    move_all_pages_files(all_crawled_pages, args.output_dir)