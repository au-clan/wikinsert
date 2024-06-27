import pandas as pd
import argparse
import math
from tqdm import tqdm
import os
from multiprocessing import Pool, cpu_count
tqdm.pandas()
import time
from preprocessing import *
import subprocess


def call_crawler(titles, curids, oldids, outfolder, lang):
    #run crawler/crawl_full_pages.js using command, it can take all at once
    for title, curid, oldid in zip(titles, curids, oldids):
        command = ['node', 'crawler/crawl_full_pages.js'] + ['-l'] + [lang] + ['-p'] + [outfolder] + ['-t'] + [title] + ['-c'] + [curid] + ['-o'] + [oldid]
        subprocess.run(command, check=True)

def move_file(current_path, new_path):
    os.rename(current_path, new_path)

def move_single_page_files(crawled_files_name, curid_oldid, crawling_outdir):

    index_file_path = f"{crawling_outdir}/{curid_oldid}"

    for crawled_file in crawled_files_name:
        file_path = f"{index_file_path}/{crawled_file}"
        if crawled_file == "index.html":
            move_file(file_path, f"{crawling_outdir}/{curid_oldid}.html")
        
def move_all_pages_files(crawled_pages_dirs, crawling_outdir):
        for crawled_page_dir in tqdm(crawled_pages_dirs, desc='Moving files'):
            page_dir = f"{crawling_outdir}/{crawled_page_dir}"
            page_files_name = list(os.listdir(page_dir))
            move_single_page_files(page_files_name, crawled_page_dir, crawling_outdir)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--revisions_path', type=str,
                        required=True, help='Path to the revision file')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')
    parser.add_argument('--n_processes', type=int, default=1,
                        help='Number of processes to use')
    parser.add_argument('--lang', type=str, required=True,
                        help='Language of the pages')
    parser.add_argument('--crawl_second_versions', type=bool, required=False, default=False,
                        help='Whether to crawl the second versions')

    
    args = parser.parse_args()

    # check if input files exist
    if not os.path.exists(args.revisions_path):
        print(args.revisions_path)
        raise Exception('Revisions file does not exist')
   
    # create the output directory if it does not exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
    

    revisions_clean = pd.read_parquet(args.revisions_path)

    curids = [str(row['source_ID'])        for _, row in revisions_clean.iterrows()]
    oldids = [str(row['first_version'])    for _, row in revisions_clean.iterrows()]
    titles = [row['source_title']          for _, row in revisions_clean.iterrows()]

    if args.crawl_second_versions:
        print("here")
        curids += [str(row['source_ID'])    for _, row in revisions_clean.iterrows() for _ in row['versions']]
        oldids += [str(version)             for _, row in revisions_clean.iterrows() for version in row['versions']]
        titles += [row['source_title']      for _, row in revisions_clean.iterrows() for _ in row['versions']]


    print(f"Total number of pages to crawl: {len(curids)}")

    nb_processes_ = min(cpu_count(), args.n_processes)

    batch_size_1 = math.ceil(len(curids) / nb_processes_)

    batched_curids = [curids[i:i + batch_size_1] for i in range(0, len(curids), batch_size_1)]
    batched_oldids = [oldids[i:i + batch_size_1] for i in range(0, len(oldids), batch_size_1)]
    batched_titles = [titles[i:i + batch_size_1] for i in range(0, len(titles), batch_size_1)]

    print(f"Running crawling on {nb_processes_} processes")
    start_time = time.time()
    with Pool(processes=nb_processes_) as pool:
        pool.starmap(call_crawler, zip(batched_titles, batched_curids, batched_oldids, [args.output_dir]*len(batched_titles), [args.lang]*len(batched_titles)))

    end_time = time.time()
    duration_in_minutes = (end_time - start_time) / 60
    print(f"Crawling finished in {duration_in_minutes} minutes, post processing...")

    # move the files to the correct location

    all_crawled_pages = list(os.listdir(args.output_dir))

    """if any([".html" in page for page in all_crawled_pages]):
        print("Warning: Some pages have already been crawled and moved here, please remove the output directory and rerun the script. Right they we be automatically removed")
        for page in all_crawled_pages:
            if page.endswith(".html"):
                os.remove(f"{args.output_dir}/{page}")
        all_crawled_pages = list(os.listdir(args.output_dir))"""

    move_all_pages_files(all_crawled_pages, args.output_dir)