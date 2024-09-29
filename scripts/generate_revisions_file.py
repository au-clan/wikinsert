"""
generate_revisions_file.py

Generates a revisions file for web crawling using data from a previous study. 
Identifies page IDs to crawl and saves the output in Parquet format.

Usage:
    python generate_revisions_file.py --versions_file <versions_file> 
                                       --html_dir <html_dir> 
                                       --redirect_1 <redirect_1> 
                                       --redirect_2 <redirect_2> 
                                       --mention_map <mention_map> 
                                       --save_path <save_directory>

Arguments:
    --versions_file (str): Required path to the versions file.
    --html_dir (str): Optional path to parsed HTML files.
    --redirect_1 (str): Required path to the first redirect file.
    --redirect_2 (str): Required path to the second redirect file.
    --mention_map (str): Required path to the mention map file.
    --save_path (str): Required path for the output directory.

Functionality:
    Validates input, processes data to create a revisions dictionary, and identifies page IDs for crawling.

Example:
    python generate_revisions_file.py --versions_file versions.parquet \
                                       --html_dir parsed_html/ \
                                       --redirect_1 redirect1.parquet \
                                       --redirect_2 redirect2.parquet \
                                       --mention_map mention_map.parquet \
                                       --save_path output/revisions.parquet
"""


import pandas as pd
import argparse
import math
from tqdm import tqdm
import os
from multiprocessing import Pool, cpu_count
tqdm.pandas()
from scripts.preprocessing import *

if __name__ == '__main__':
    # Initialize the argument parser
    parser = argparse.ArgumentParser()
    
    # Define command-line arguments for the script
    parser.add_argument('--versions_file', type=str,
                        required=True, help='Path to the versions file')
    parser.add_argument('--html_dir', type=str, required=False, default=None,
                        help='Path to the directory containing all the parsed HTML files, both links and sentences')
    parser.add_argument('--redirect_1', type=str, required=True,
                        help='Path to the first redirect file')
    parser.add_argument('--redirect_2', type=str, required=True,
                        help='Path to the second redirect file')
    parser.add_argument('--mention_map', type=str, required=True,
                        help='Path to the mention map file')
    parser.add_argument('--save_path', type=str, required=True,
                        help='Path to the output directory')

    # Parse the command-line arguments
    args = parser.parse_args()

    # Check if input files exist; raise an exception if any are missing
    if not os.path.exists(args.versions_file):
        print(args.versions_file)
        raise Exception('Versions file does not exist')
    if args.html_dir is not None and not os.path.exists(args.html_dir):
        raise Exception(f'HTML directory {args.html_dir} does not exist')
    if not os.path.exists(args.redirect_1):
        raise Exception('Redirect file 1 does not exist')
    if not os.path.exists(args.redirect_2):
        raise Exception('Redirect file 2 does not exist')
    if not os.path.exists(args.mention_map):
        raise Exception('Mention map file does not exist')

    # Load the data from parquet files into DataFrames
    df_versions = pd.read_parquet(args.versions_file)
    redirect_1 = pd.read_parquet(args.redirect_1)
    redirect_2 = pd.read_parquet(args.redirect_2)

    # Convert redirect DataFrames to dictionaries for easy access
    redirect_1 = redirect_1.to_dict()['redirect']
    redirect_2 = redirect_2.to_dict()['redirect']

    # Fix target titles in the versions DataFrame using redirect mappings
    df_versions['target_title'] = df_versions['target_title'].apply(
        lambda x: fix_target_titles(x, redirect_1, redirect_2))

    # Convert DataFrame to a list of records for easier processing
    df_versions = df_versions.to_dict('records')
    expected_links = len(df_versions)
    #print(f'Expected links: {expected_links}')
    
    # Initialize a dictionary to store revisions
    revisions = {}
    
    # Create the revisions dictionary from the loaded data
    for row in tqdm(df_versions, total=expected_links, desc='Creating revisions dictionary'):
        if row['first_version'] not in revisions:
            # Create a new entry for the first version
            revisions[row['first_version']] = {
                'source_title': row['source_title'],
                'source_ID': row['source_ID'],
                'versions': {
                    row['second_version']: [row['target_title']]
                }
            }
        else:
            # Update existing entry with new version information
            if row['second_version'] not in revisions[row['first_version']]['versions']:
                revisions[row['first_version']]['versions'][row['second_version']] = [
                    row['target_title']]
            else:
                revisions[row['first_version']]['versions'][row['second_version']].append(
                    row['target_title'])

    # Initialize a list to store clean revisions
    revisions_clean = []

    # Check for the existence of HTML files if html_dir is provided
    if args.html_dir is not None:
        for revision in tqdm(revisions, desc='Checking revisions'):
            # Check if the HTML file for the source ID and revision exists
            if os.path.exists(f"{args.html_dir}/{revisions[revision]['source_ID']}_{revision}.html"):
                versions = []
                # Check each version for its corresponding HTML file
                for version in revisions[revision]['versions']:
                    if os.path.exists(f"{args.html_dir}/{revisions[revision]['source_ID']}_{version}.html"):
                        versions.append(version)
                
                # If any versions exist, add them to the clean revisions list
                if len(versions) > 0:
                    revisions_clean.append({
                        'first_version': revision,
                        'source_title': revisions[revision]['source_title'],
                        'source_ID': revisions[revision]['source_ID'],
                        'versions': versions
                    })    
                else:
                    print(f"Missing versions for revision {revision}")
            else:
                print(f"Missing revision {revision}")
    else:
        # If no HTML directory is provided, add all revisions to clean revisions
        for revision in revisions:
            revisions_clean.append({
                'first_version': revision,
                'source_title': revisions[revision]['source_title'],
                'source_ID': revisions[revision]['source_ID'],
                'versions': list(revisions[revision]['versions'].keys())
            })
            
    # Save the clean revisions into a DataFrame
    revisions_df = pd.DataFrame(revisions_clean)

    # Calculate the number of versions and sort by this number
    revisions_df['len_vers'] = revisions_df['versions'].apply(len)
    revisions_df = revisions_df.sort_values(by='len_vers', ascending=False).reset_index(drop=True)
    
    # Drop the temporary length column and save the DataFrame to a parquet file
    revisions_df = revisions_df.drop(columns=['len_vers'])
    revisions_df.to_parquet(args.save_path)
