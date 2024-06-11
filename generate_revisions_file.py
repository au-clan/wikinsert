import pandas as pd
import argparse
import math
from tqdm import tqdm
import os
from multiprocessing import Pool, cpu_count
tqdm.pandas()
from preprocessing import *

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
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
    parser.add_argument('--max_samples', type=int, default=None,
                        help='Maximum number of samples to use')
    parser.add_argument('--save_path', type=str, required=True,
                        help='Path to the output directory')

    args = parser.parse_args()

    # check if input files exist
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

    # load the data
    df_versions = pd.read_parquet(args.versions_file)
    redirect_1 = pd.read_parquet(args.redirect_1)
    redirect_2 = pd.read_parquet(args.redirect_2)

    redirect_1 = redirect_1.to_dict()['redirect']
    redirect_2 = redirect_2.to_dict()['redirect']

    df_versions['target_title'] = df_versions['target_title'].apply(
        lambda x: fix_target_titles(x, redirect_1, redirect_2))

    df_versions = df_versions.to_dict('records')
    expected_links = len(df_versions)
    #print(f'Expected links: {expected_links}')
    revisions = {}
    for row in tqdm(df_versions, total=expected_links, desc='Creating revisions dictionary'):
        if row['first_version'] not in revisions:
            revisions[row['first_version']] = {
                'source_title': row['source_title'],
                'source_ID': row['source_ID'],
                'versions': {
                    row['second_version']: [row['target_title']]
                }
            }
        else:
            if row['second_version'] not in revisions[row['first_version']]['versions']:
                revisions[row['first_version']]['versions'][row['second_version']] = [
                    row['target_title']]
            else:
                revisions[row['first_version']]['versions'][row['second_version']].append(
                    row['target_title'])
    
    revisions_clean = []

    if args.html_dir is not None:
        for revision in tqdm(revisions, desc='Checking revisions'):
            if os.path.exists(f"{args.html_dir}/{revisions[revision]['source_ID']}_{revision}.html"):
                versions = []
                for version in revisions[revision]['versions']:
                    if os.path.exists(f"{args.html_dir}/{revisions[revision]['source_ID']}_{version}.html"):
                        versions.append(version)
                
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
        for revision in revisions:
            revisions_clean.append({
                'first_version': revision,
                'source_title': revisions[revision]['source_title'],
                'source_ID': revisions[revision]['source_ID'],
                'versions': list(revisions[revision]['versions'].keys())
            })
            
    
    # Save the revisions dictionary
    revisions_df = pd.DataFrame(revisions_clean)

    if args.max_samples is not None:
        revisions_df = revisions_df.sample(min(args.max_samples, revisions_df.shape[0]), random_state=42)

    revisions_df['len_vers'] = revisions_df['versions'].apply(len)
    revisions_df = revisions_df.sort_values(by='len_vers', ascending=False).reset_index(drop=True)
    revisions_df = revisions_df.drop(columns=['len_vers'])
    revisions_df.to_parquet(args.save_path)