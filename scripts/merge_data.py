"""
merge_data.py

This script merges data from raw and test data directories for specified languages and context sizes. 
It processes files by loading mention maps, applying title fixes using redirects, and cleaning links.
It is the final step ofpreprocessing before inference can be done.

Usage:
    python merge_data.py --test_data_dir <path_to_test_data> --raw_data_dir <path_to_raw_data> 
    --langs <language1 language2 ...> --side_contexts_sizes <size1 size2 ...> --output_dir <output_directory> 
    [--ignore_warnings]

Arguments:
    --test_data_dir (str): Directory containing test data files.
    --raw_data_dir (str): Directory containing raw data files.
    --langs (str): Languages to merge, separated by spaces.
    --side_contexts_sizes (str): Context sizes to merge, separated by spaces.
    --output_dir (str): Directory for saving output files.
    --ignore_warnings (optional): Ignore warnings about missing files.

Note:
This script requires pandas and assumes data files are in parquet format.
"""

import pandas as pd
import argparse
import os
from glob import glob
from tqdm import tqdm
import gc
tqdm.pandas()


def fix_title(title: str, redirect_1: Dict[str, str], redirect_2: Dict[str, str]) -> str:
    """
    Fixes a given title by following redirects from two dictionaries.

    This function takes a title and attempts to resolve it through two sets of redirects.
    It will follow redirects from 'redirect_1' first, then from 'redirect_2', up to a maximum
    of 10 redirects for each.

    Parameters:
        title (str): The title to be fixed.
        redirect_1 (Dict[str, str]): A dictionary of redirects for the first set.
        redirect_2 (Dict[str, str]): A dictionary of redirects for the second set.

    Returns:
        str: The resolved title after following the redirects.
    """
    
    # Counter to prevent infinite loops due to excessive redirects
    counter = 0
    
    # Follow redirects in the first set
    while title in redirect_1:
        title = redirect_1[title]
        counter += 1
        if counter > 10:
            break  # Exit if more than 10 redirects are followed
    
    # Reset counter for the second set of redirects
    counter = 0
    
    # Follow redirects in the second set
    while title in redirect_2:
        title = redirect_2[title]
        counter += 1
        if counter > 10:
            break  # Exit if more than 10 redirects are followed
    
    return title  # Return the resolved title

if __name__ == '__main__':
    # Create an argument parser to handle command-line arguments
    parser = argparse.ArgumentParser()
    
    # Argument for the directory containing test data
    parser.add_argument('--test_data_dir', type=str, required=True,
                        help='Path to the directory containing the test_data')
    
    # Argument for the directory containing raw data
    parser.add_argument('--raw_data_dir', type=str, required=True,
                        help='Path to the directory containing the raw data')
    
    # Argument for languages to merge; accepts multiple languages
    parser.add_argument('--langs', type=str, nargs='+',
                        required=True, help='Languages to merge')
    
    # Argument for sizes of side contexts to merge; accepts multiple sizes
    parser.add_argument('--side_contexts_sizes', type=str, nargs='+',
                        required=True, help='Sizes of side contexts to merge')
    
    # Argument for the output directory where results will be saved
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output dir')
    
    # Argument to ignore warnings; default is False
    parser.add_argument('--ignore_warnings', action='store_true', default=False,
                        help='Ignore warnings')
    
    # Set the default for ignore_warnings
    parser.set_defaults(ignore_warnings=False)
    
    # Parse the command-line arguments
    args = parser.parse_args()
    
    # Check if the specified test data directory exists
    if not os.path.exists(args.test_data_dir):
        raise ValueError('Test Data directory does not exist')
    
    # Check if the specified raw data directory exists
    if not os.path.exists(args.raw_data_dir):
        raise ValueError('Raw Data directory does not exist')

    # Split the languages and side context sizes from command-line arguments
    langs = args.langs[0].split(',')
    side_contexts_sizes = args.side_contexts_sizes[0].split(',')

    # Check if all the language-specific files exist
    for lang in langs:
        for side_contexts_size in side_contexts_sizes:
            # Check for the existence of the test data file for each language and context size
            if not os.path.exists(os.path.join(args.test_data_dir, lang, f'context_size_{side_contexts_size}', 'test_data.parquet')):
                # Remove the language from the list if the file doesn't exist
                if lang in langs:
                    langs.remove(lang)
                # Raise an error or print a warning based on ignore_warnings flag
                if not args.ignore_warnings:
                    raise ValueError(f'Link file for language {lang} and context size {side_contexts_size} does not exist')
                else:
                    print(f'Warning: link file for language {lang} and context size {side_contexts_size} does not exist')
        
        # Check for existence of redirect files for both context sizes
        for redirect_index in range(1, 3):
            redirect_file = os.path.join(args.raw_data_dir, f'{lang}wiki-NS0-20231{redirect_index:02}', 'processed_data', 'redirect_map.parquet')
            if not os.path.exists(redirect_file):
                if lang in langs:
                    langs.remove(lang)
                if not args.ignore_warnings:
                    raise ValueError(f'Redirect file {redirect_index} for language {lang} does not exist')
                else:
                    print(f'Warning: redirect file {redirect_index} for language {lang} does not exist')

        # Check for existence of pages files
        pages_file = os.path.join(args.raw_data_dir, f'{lang}wiki-NS0-20231001', 'processed_data', 'good_pages')
        if not os.path.exists(pages_file):
            if lang in langs:
                langs.remove(lang)
            if not args.ignore_warnings:
                raise ValueError(f'Pages files for language {lang} do not exist')
            else:
                print(f'Warning: pages files for language {lang} do not exist')
    
    # Check if the output directory exists; create it if it does not
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    print('Saving mention maps:')
    for i, lang in enumerate(langs):
        # Process each language's mention map
        print(f'Processing language {lang} ({i+1}/{len(langs)})')
        
        # Load mention map data from parquet file
        df_mentions = pd.read_parquet(os.path.join(args.raw_data_dir, f'{lang}wiki-NS0-20231001', 'processed_data', 'mention_map.parquet'))
        
        # Save the mention map data to the output directory
        df_mentions.to_parquet(os.path.join(args.output_dir, f'mention_map_{lang}.parquet'))
        
        # Free memory
        df_mentions = None
        del df_mentions
        gc.collect()
        print(f'Finished processing language {lang}')

    print('Done saving mention maps:')

    # Process each language sequentially
    for i, lang in enumerate(langs):
        print(f'Processing language {lang} ({i+1}/{len(langs)})')
        
        # Load pages from good_pages files
        files = glob(os.path.join(args.raw_data_dir, f'{lang}wiki-NS0-20231001', 'processed_data', 'good_pages*'))
        try:
            # Attempt to concatenate all good pages
            df_pages = pd.concat([pd.read_parquet(file, columns=['title', 'lead_paragraph'])
                                  for file in files]).reset_index(drop=True)
        except:
            # If that fails, try a more specific path
            files = glob(os.path.join(args.raw_data_dir, f'{lang}wiki-NS0-20231001', 'processed_data', 'good_pages', '*'))
            dfs = []
            for file in files:
                try:
                    # Attempt to read each file individually
                    df = pd.read_parquet(file, columns=['title', 'lead_paragraph'])
                    dfs.append(df)
                except:
                    print(f'Error reading file {file}')
            # Concatenate the successfully read dataframes
            df_pages = pd.concat(dfs).reset_index(drop=True)

        print('Loaded pages')
        
        # Load redirect maps
        df_redirect_1 = pd.read_parquet(os.path.join(args.raw_data_dir, f'{lang}wiki-NS0-20231001', 'processed_data', 'redirect_map.parquet'))
        df_redirect_2 = pd.read_parquet(os.path.join(args.raw_data_dir, f'{lang}wiki-NS0-20231101', 'processed_data', 'redirect_map.parquet'))
        
        # Convert redirect dataframes to dictionaries for easier access
        redirect_1 = df_redirect_1.to_dict()['redirect']
        redirect_2 = df_redirect_2.to_dict()['redirect']
        
        # Free memory from redirect dataframes
        df_redirect_1 = None
        del df_redirect_1
        df_redirect_2 = None
        del df_redirect_2
        print('Loaded redirects')

        # Fix titles in the pages dataframe using the redirect dictionaries
        df_pages['title'] = df_pages['title'].progress_apply(lambda x: fix_title(x, redirect_1, redirect_2))
        
        # Free memory used by redirect dictionaries
        redirect_1 = None
        del redirect_1
        redirect_2 = None
        del redirect_2
        
        # Create a dictionary where keys are titles and values are lead paragraphs
        pages = df_pages.set_index('title').to_dict()['lead_paragraph']
        df_pages = None
        del df_pages

        # Process each specified context size
        for j in side_contexts_sizes:
            print(f'Processing context size {j}')
            # Load link data from the test data directory
            try:
                df_links = pd.read_parquet(os.path.join(args.test_data_dir, lang, f'context_size_{j}', 'test_data.parquet'))
            except:
                print(f'Error reading file {os.path.join(args.test_data_dir, lang, f"context_size_{j}", "test_data.parquet")}')
                continue
            
            print(f'Loaded links for context_size_{j}')
            
            # Clean links dataframe: remove links with empty contexts
            print(f"Originally, there are {len(df_links)} links for language {lang}")
            df_removed = df_links['all_contexts'].apply(len) == 0
            df_links = df_links[~df_removed]
            print(f"Removed {df_removed.sum()} links because of empty contexts")
            
            # Remove links where the target title is not in the source titles
            df_removed = ~df_links['target_title'].isin(pages)
            df_links = df_links[~df_removed]
            print(f"Removed {df_removed.sum()} links because target title is not in source titles")
            
            # Remove links marked as 'missing_section'
            df_removed = df_links['missing_category'] == 'missing_section'
            df_links = df_links[~df_removed]
            print(f"Removed {df_removed.sum()} links because of missing section")
            
            print(f"After cleaning, there are {len(df_links)} links for language {lang}")
            
            # Map target titles to their corresponding lead paragraphs
            df_links['target_lead'] = df_links['target_title'].apply(lambda x: pages[x])
            df_links = df_links.reset_index(drop=True)
            # Save cleaned links to the output directory
            df_links.to_parquet(os.path.join(args.output_dir, f'{lang}_{j}.parquet'))
            
            # Free memory used by links dataframe
            df_links = None
            del df_links
            gc.collect()

        # Free memory used by pages dictionary
        pages = None
        del pages
        gc.collect()
        
        print(f'Finished processing language {lang}')
