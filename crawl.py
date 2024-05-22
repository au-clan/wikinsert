import pandas as pd
import argparse
import math
from tqdm import tqdm
import os
from multiprocessing import Pool, cpu_count
tqdm.pandas()
import time
from modular_preprocessing import *
import subprocess


def call_crawler(titles, curids, oldids, outfolder):
    #run crawler/crawl_full_pages.js using command, it can take all at once

    command = ['node', 'crawler/crawl_full_pages.js'] + ['-p'] + [outfolder] + ['-t'] + titles + ['-c'] + curids + ['-o'] + oldids

    subprocess.run(command, check=True)


def move_file(inpath, oupath):
    for inpath, oupath in zip(inpaths, oupaths):
        os.rename(inpath, oupath)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--revisions_path', type=str,
                        required=True, help='Path to the revision file')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')
    parser.add_argument('--n_processes', type=int, default=1,
                        help='Number of processes to use')
    parser.add_argument('--crawl_second_versions', type=bool, required=False, default=False,
                        help='Whether to crawl the second versions')
    parser.add_argument('--future_colored_htmls_path', type=str, required=True,
                        help='Path to the future colored htmls file')

    
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
    print("Parallel multiprocess")
    with Pool(processes=nb_processes_) as pool:
        pool.starmap(call_crawler, zip(batched_titles, batched_curids, batched_oldids, [args.output_dir]*len(batched_titles)))

    print("Crawling finished, post processing...")

    # move the files to the correct location

    all_crawled_pages = list(os.listdir(args.output_dir))

    for page in all_crawled_pages:
        crawled_files = list(os.listdir(f"{args.output_dir}/{page}"))
        os.makedirs(f"{args.futur_colored_htmls_path}/{page}", exist_ok=True)
        for crawled_file in crawled_files:
            if crawled_file.endswith(".html"):
                os.rename(f"{args.output_dir}/{page}/{crawled_file}", f"{args.output_dir}/{page}.html")
            else:
                os.rename(f"{args.output_dir}/{page}/{crawled_file}", f"{args.futur_colored_htmls_path}/{page}/{crawled_file}")