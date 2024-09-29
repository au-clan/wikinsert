"""
color_pages.py

This module processes scored data and generates colored HTML pages based on the analysis of missing categories
in the data. It takes various input directories and parameters from the command line to execute the processing 
pipeline, creating sorted links and potentially soft links for missing categories.

Main functionalities include:
- Parsing command-line arguments for input and output directories.
- Validating the existence of necessary data files and directories.
- Generating paths for colored HTML pages based on scored data.
- Creating soft links if specified in the arguments.
- Saving the generated HTML to the specified output directory.

Command-line Arguments:
- --scored_data_dir: Path to the directory containing scored data files (required).
- --html_dir: Path to the directory containing raw HTML files (required).
- --sorted_links_output_dir: Path to the output directory for sorted links (required).
- --soft_links_dir: Path to the directory for creating soft links (optional).
- --langs: Comma-separated list of languages to benchmark (required).
- --side_contexts_sizes: Comma-separated list of sizes for side contexts to benchmark (required).
- --extra_crawled_files_dir: Path to an optional directory for extra crawled files (optional).
- --full_model_name: Full name of the model used for scoring (required).

Usage:
Run this module from the command line with the appropriate arguments. 
Example:
    python color_pages.py --scored_data_dir <path> --html_dir <path> --sorted_links_output_dir <path> --langs <languages> --side_contexts_sizes <sizes> --full_model_name <model_name>
"""

from calendar import c
from numpy import argsort
import pandas as pd
import numpy as np
import argparse
from bs4 import BeautifulSoup, Comment, MarkupResemblesLocatorWarning
from nltk import sent_tokenize
from tqdm import tqdm
import os
from multiprocessing import Pool, cpu_count
import matplotlib.colors as mcolors
import seaborn as sns
from matplotlib.colors import LinearSegmentedColormap
tqdm.pandas()
import execjs
import json
import hashlib


#compile js file to use it later
HEAT_MAP_UTIL = 'js_page_colouring/heatmap_utils.js'
HEAT_MAP_BUILDER = 'overlayHeatMap'

with open (HEAT_MAP_UTIL, "r") as f:
    heat_map_util = f.read()

heat_map_util_compiled = execjs.compile(heat_map_util)

def dict_to_html_list(data: Dict[str, List[Dict[str, str]]]) -> str:
    """
    Convert a dictionary of categories and URLs into an HTML unordered list.
    Used for easy visualisation and brwosing of the pages

    Args:
        data (Dict[str, List[Dict[str, str]]]): A dictionary where keys are 
            categories and values are lists of dictionaries containing URL titles 
            and their corresponding URLs.

    Returns:
        str: An HTML string representing the nested unordered list.
    """
    html = '<ul>'
    for category, urls in data.items():
        html += f'<li>{category}: <ul>'
        for url_dict in urls:
            for url_title, url in url_dict.items():
                html += f'<li><a href="{url}" target="_blank">{url_title}</a></li>'
        html += '</ul></li>'
    html += '</ul>'
    return html

def compute_md5(input_string: str) -> str:
    """
    Compute the MD5 hash of a given string.

    Args:
        input_string (str): The string to hash.

    Returns:
        str: The hexadecimal representation of the MD5 hash.
    """
    # Create an MD5 hash object
    md5_hash = hashlib.md5()
    
    # Encode the input string to bytes and update the hash object
    md5_hash.update(input_string.encode('utf-8'))
    
    # Return the hexadecimal representation of the hash
    return md5_hash.hexdigest()

def normalize_scores(contexts: List[Dict[str, Any]], smoothing_param: float) -> List[Dict[str, Any]]:
    """
    Normalize scores in a list of context dictionaries.

    Args:
        contexts (List[Dict[str, Any]]): A list of dictionaries, each containing 
            a score under the key 'score'.
        smoothing_param (float): A parameter to adjust the normalization smoothing.

    Returns:
        List[Dict[str, Any]]: The input list with an added 'normalized_score' 
        key in each dictionary.
    """
    scores = [context['score'] for context in contexts]
    min_ = np.min(scores)
    nm_scores = scores - min_
    max_ = np.max(nm_scores)

    if max_ == 0:
        nm_scores = [1.0 for _ in nm_scores]
    else:
        nm_scores = nm_scores / np.max(nm_scores)
        nm_scores = nm_scores ** (1/smoothing_param)

    for context, score in zip(contexts, nm_scores):
        context['normalized_score'] = score

    return contexts

def black_to_red(normalized_scores: List[float]) -> List[tuple]:
    """
    Convert normalized scores to RGB colors from black to red.

    Args:
        normalized_scores (List[float]): A list of normalized scores.

    Returns:
        List[tuple]: A list of RGBA colors corresponding to the normalized scores.
    """
    colors = [(0.0, 1.0, score) for score in normalized_scores]
    colors = [mcolors.hsv_to_rgb(color) * 255 for color in colors]
    colors = [(color[0], color[1], color[2], 255) for color in colors]
    return colors

def blue_to_red(normalized_scores: List[float]) -> List[tuple]:
    """
    Convert normalized scores to RGB colors using a blue-to-red palette.

    Args:
        normalized_scores (List[float]): A list of normalized scores.

    Returns:
        List[tuple]: A list of RGBA colors corresponding to the normalized scores.
    """
    palette = sns.color_palette("coolwarm", as_cmap=True)
    colors = palette(normalized_scores)
    colors = [(color[0] * 255, color[1] * 255, color[2] * 255, 255) for color in colors]
    return colors

def grey_to_red(normalized_scores: List[float]) -> List[tuple]:
    """
    Convert normalized scores to RGB colors using a grey-to-red palette.

    Args:
        normalized_scores (List[float]): A list of normalized scores.

    Returns:
        List[tuple]: A list of RGBA colors corresponding to the normalized scores.
    """
    palette = sns.color_palette(palette='blend:gray,r', as_cmap=True)
    colors = palette(normalized_scores)
    colors = [(color[0] * 255, color[1] * 255, color[2] * 255, (score + 0.3) / 4) 
              for score, color in zip(normalized_scores, colors)]
    return colors

def color_contexts(contexts: List[Dict[str, Any]], coloring_func: Callable[[List[float]], List[Tuple[int, int, int]]]) -> List[Dict[str, Any]]:
    """
    Color contexts based on their normalized scores.

    Args:
        contexts (List[Dict[str, Any]]): A list of dictionaries where each dictionary 
            contains a 'normalized_score' key.
        coloring_func (Callable[[List[float]], List[Tuple[int, int, int]]]): A function 
            that takes a list of normalized scores and returns a list of colors in the 
            format [(int, int, int)].

    Returns:
        List[Dict[str, Any]]: The input list of contexts with an additional 'color' key 
        in each dictionary.
    
    Raises:
        ValueError: If the color cannot be converted to integers.
    """
    colors = coloring_func([context['normalized_score'] for context in contexts])
    for context, color in zip(contexts, colors):
        try:
            context['color'] = int(color[0]), int(color[1]), int(color[2]), color[3]
        except ValueError as e:
            print(color)
            raise e

    return contexts

def overlay_heatmap(
    colored_contexts: List[Dict[str, Any]], 
    source_ID: str, 
    first_version: str, 
    missing_category: str, 
    insert_indices: List[int], 
    moved_insertion_marker: Any, 
    link_text: str, 
    link_sentence: str, 
    html_folder_path: str, 
    save_folder: str, 
    context_size: str
) -> None:
    """
    Overlay a heatmap on the colored contexts and save the output.
    Calls the node js html heat map builder 

    Args:
        colored_contexts (List[Dict[str, Any]]): A list of colored context dictionaries 
            with a 'color' key.
        source_ID (str): The source ID for the context.
        first_version (str): The version identifier for the context.
        missing_category (str): The category to be marked as missing.
        insert_indices (List[int]): Indices for insertion in the context.
        moved_insertion_marker (Any): A marker for moved insertions.
        link_text (str): Text to be linked in the output HTML.
        link_sentence (str): Sentence containing the link in the output HTML.
        html_folder_path (str): Path to the folder containing HTML templates.
        save_folder (str): Path to the folder where results will be saved.
        context_size (str): Size of the context for naming output files.

    Raises:
        ValueError: If the output folder does not exist.
    """
    color_store = get_color_store(colored_contexts, missing_category, insert_indices, moved_insertion_marker, link_sentence, link_text)
    save_folder_page = f"{save_folder}/{source_ID}_{first_version}"

    if not os.path.exists(save_folder_page):
        raise ValueError(f'Folder {save_folder_page} does not exist')

    raw_html_file_path = f"{html_folder_path}/{source_ID}_{first_version}.html"
    output_path = f"{save_folder_page}/{context_size}_{compute_md5(link_text)}_index.html"

    heat_map_util_compiled.call(HEAT_MAP_BUILDER, color_store, raw_html_file_path, output_path)

def colouring_pipeline(
    df: pd.DataFrame, 
    save_folder: str, 
    html_folder_path: str, 
    context_size: str, 
    styles_coloring_funcs_pairs: List[Tuple[str, Callable[[List[float]], List[Tuple[int, int, int]]]]] = [('highlight', grey_to_red)], 
    smoothing_params: List[float] = [1], 
    overlaying_func: Callable[..., None] = overlay_heatmap
) -> None:
    """
    Color contexts in a DataFrame with different styles and save the results as HTML files.

    Args:
        df (pd.DataFrame): A DataFrame containing a column 'all_contexts' 
            with contexts to color and additional columns for metadata.
        save_folder (str): The folder path where the output HTML files will be saved.
        html_folder_path (str): The path to the folder containing HTML templates.
        context_size (str): Size of the context for naming output files.
        styles_coloring_funcs_pairs (List[Tuple[str, Callable[[List[float]], List[Tuple[int, int, int]]]]]): 
            A list of tuples, each containing a style name and the corresponding coloring function.
        smoothing_params (List[float]): A list of smoothing parameters to apply during normalization.
        overlaying_func (Callable[..., None]): A function that overlays a heatmap on the colored contexts.

    Returns:
        None: The function saves HTML files in the specified save folder.
    """
    for style, coloring_func in styles_coloring_funcs_pairs:
        print(f'Coloring with {coloring_func.__name__}')
        for smoothing_param in smoothing_params:
            print(f'Smoothing param: {smoothing_param}')
            
            # Normalize scores for each context
            df['all_contexts'] = df['all_contexts'].progress_apply(lambda x: normalize_scores(x, smoothing_param))
            # Color the contexts based on normalized scores
            df['all_contexts'] = df['all_contexts'].progress_apply(lambda x: color_contexts(x, coloring_func))
            print(f'Style: {style}')

            # Overlay heatmap on each context and save as HTML
            df.progress_apply(lambda x: overlaying_func(
                x['all_contexts'],
                x['source_ID'],
                x['first_version'],
                x['missing_category'],
                x['insert_indices'],
                x['moved_insertion_marker'],
                x['link_text'],
                x['link_sentence'],
                html_folder_path,
                save_folder,
                context_size
            ), axis=1)


def get_html_paths(data_path: str, scored_df: pd.DataFrame) -> pd.Series:
    """
    Generate HTML file paths based on source ID and version from a DataFrame.

    Args:
        data_path (str): The base data path where HTML files are located.
        scored_df (pd.DataFrame): A DataFrame containing 'source_ID' and 'first_version' columns.

    Returns:
        pd.Series: A Series of HTML file paths constructed from the DataFrame entries.
    """
    data_path_in = f"{data_path}"
    
    # Construct paths for each entry in the DataFrame
    paths = scored_df.progress_apply(lambda x: f"{data_path_in}/{x['source_ID']}_{x['first_version']}.html", axis=1)

    return paths

def get_color_store(
    contexts: List[Dict[str, Any]], 
    missing_category: str, 
    insert_index: List[int], 
    moved_insertion_marker: Optional[List[int]], 
    link_sentence: str, 
    link_text: str
) -> List[Dict[str, Any]]:
    """
    Generate a color store for contexts based on their properties and missing categories.

    Args:
        contexts (List[Dict[str, Any]]): A list of context dictionaries, each containing 
            fields such as 'middle_sentence', 'color', 'score', and 'normalized_score'.
        missing_category (str): The category of missing contexts (e.g., 'missing_sentence').
        insert_index (List[int]): The indices where insertions are supposed to occur.
        moved_insertion_marker (Optional[List[int]]): Indices for the moved insertion marker, if any.
        link_sentence (str): The sentence that will be linked in the HTML output.
        link_text (str): The text of the link.

    Returns:
        List[Dict[str, Any]]: A list of dictionaries containing information for each context's 
        coloring, including properties such as start and end positions, color, and whether it is special.

    Raises:
        ValueError: If the insert index is not found or if no special context is found.
    """
    color_store = []
    one_special = False

    # Check if the insert index is not found and raise an error if necessary
    if all([i == j for i, j in zip([-1], insert_index)]):
        if missing_category not in ['missing_sentence', 'missing_span']:
            raise ValueError('Insert index not found')

        first_llist = contexts[0]['middle_sentence']['locList1']
        first_color = contexts[0]['color']
        first_score = contexts[0]['score']
        most_red = bool(first_score == 1)

        # Add the first context to color_store with special properties
        color_store.append({
            'start': first_llist[0]['start'],
            'end': first_llist[0]['start'],
            'color': first_color,
            'special': True,
            'most_red': most_red,
            'sentence_end': 0,
            'missing_category': missing_category,
            'link_sentence_parts': link_sentence.split(link_text, 1),
            'link_text': link_text,
            'last': True
        })
        one_special = True

    # Process each context to populate the color store
    for context in contexts:
        score = context['normalized_score']
        most_red = bool(score == 1)
        middle_sentence = context['middle_sentence']
        indexes = middle_sentence['ids1']
        llist = middle_sentence['locList1']
        sent_end = middle_sentence['endIdx1']
        special = all([i == j for i, j in zip(indexes, insert_index)])

        if not special:
            # Add normal contexts to the color store
            for lindexes in llist:
                loc = {
                    'start': lindexes['start'],
                    'end': lindexes['end'],
                    'color': context['color'],
                    'special': False,
                    'most_red': most_red,
                    'sentence_end': sent_end,
                    'missing_category': missing_category
                }
                color_store.append(loc)
        else:
            one_special = True

            # Handle different types of missing categories
            if missing_category in ['missing_sentence', 'missing_span']:
                for lindexes in llist[:-1]:
                    loc = {
                        'start': lindexes['start'],
                        'end': lindexes['end'],
                        'color': context['color'],
                        'special': False,
                        'most_red': most_red,
                        'sentence_end': sent_end,
                        'missing_category': missing_category
                    }
                    color_store.append(loc)

                color_store.append({
                    'start': llist[-1]['start'],
                    'end': llist[-1]['end'],
                    'color': context['color'],
                    'special': True,
                    'most_red': most_red,
                    'sentence_end': sent_end,
                    'missing_category': missing_category,
                    'link_sentence_parts': link_sentence.split(link_text, 1),
                    'link_text': link_text,
                    'last': True
                })

            elif missing_category in ['missing_mention', 'missing_mention_in_moved_sentence']:
                for lindexes in llist[:-1]:
                    loc = {
                        'start': lindexes['start'],
                        'end': lindexes['end'],
                        'color': context['color'],
                        'special': True,
                        'most_red': most_red,
                        'sentence_end': sent_end,
                        'missing_category': missing_category,
                        'last': False
                    }
                    color_store.append(loc)

                color_store.append({
                    'start': llist[-1]['start'],
                    'end': llist[-1]['end'],
                    'color': context['color'],
                    'special': True,
                    'most_red': most_red,
                    'sentence_end': sent_end,
                    'missing_category': missing_category,
                    'last': True,
                    'link_text': link_text,
                })

            elif missing_category in ['missing_mention_with_sentence_modifications', 'missing_mention_in_moved_sentence_with_modifications']:
                if link_text in middle_sentence['clean_sentence']:
                    for lindexes in llist[:-1]:
                        loc = {
                            'start': lindexes['start'],
                            'end': lindexes['end'],
                            'color': context['color'],
                            'special': True,
                            'most_red': most_red,
                            'sentence_end': sent_end,
                            'missing_category': "missing_mention",
                            'last': False
                        }
                        color_store.append(loc)

                    color_store.append({
                        'start': llist[-1]['start'],
                        'end': llist[-1]['end'],
                        'color': context['color'],
                        'special': True,
                        'most_red': most_red,
                        'sentence_end': sent_end,
                        'missing_category': "missing_mention",
                        'last': True,
                        'link_text': link_text,
                    })
                else:
                    for lindexes in llist[:-1]:
                        loc = {
                            'start': lindexes['start'],
                            'end': lindexes['end'],
                            'color': context['color'],
                            'special': False,
                            'most_red': most_red,
                            'sentence_end': sent_end,
                            'missing_category': missing_category,
                            'last': False
                        }
                        color_store.append(loc)

                    new_sentence_parts = middle_sentence['clean_sentence2'].split(link_text, 1)

                    color_store.append({
                        'start': llist[-1]['start'],
                        'end': llist[-1]['end'],
                        'color': context['color'],
                        'special': True,
                        'most_red': most_red,
                        'sentence_end': sent_end,
                        'missing_category': missing_category,
                        'last': True,
                        'new_sentence_parts': new_sentence_parts,
                        'link_text': link_text,
                    })

        # Check for moved insertion marker
        if moved_insertion_marker is not None:
            marker = all([i == j for i, j in zip(indexes, moved_insertion_marker)])

            if marker:
                loc = {
                    'start': llist[-1]['start'],
                    'end': llist[-1]['start'],
                    'color': context['color'],
                    'most_red': most_red,
                    'sentence_end': sent_end,
                    'special': True,
                    'missing_category': 'marker'
                }
                color_store.append(loc)

    # Raise an error if no special context was found
    if not one_special:
        raise ValueError('No special context found')

    return color_store


if __name__ == '__main__':
    # Create argument parser for command-line inputs
    parser = argparse.ArgumentParser()
    parser.add_argument('--scored_data_dir', type=str, required=True, help='Path to scored data directory')
    parser.add_argument('--html_dir', type=str, required=True, help='Path to raw HTML directory')
    parser.add_argument('--sorted_links_output_dir', type=str, required=True, help='Path to output directory for sorted links')
    parser.add_argument('--soft_links_dir', type=str, required=False, help='Path to output directory for soft links')
    parser.add_argument('--langs', type=str, required=True, help='Languages to benchmark (comma-separated)')
    parser.add_argument('--side_contexts_sizes', type=str, required=True, help='Sizes of side contexts to benchmark (comma-separated)')
    parser.add_argument('--extra_crawled_files_dir', type=str, required=False, default=None, help='Path to extra crawled files directory')
    parser.add_argument('--full_model_name', type=str, required=True, help='Full model name for the scoring process')

    # Parse the command-line arguments
    args = parser.parse_args()

    # Check if the specified HTML directory exists
    if not os.path.exists(args.html_dir):
        raise ValueError('HTML directory does not exist')
    
    # Create the output directory for sorted links if it doesn't exist
    if not os.path.exists(args.sorted_links_output_dir):
        os.makedirs(args.sorted_links_output_dir, exist_ok=True)
    
    # Create the soft links directory if provided and doesn't exist
    if args.soft_links_dir:
        if not os.path.exists(args.soft_links_dir):
            os.makedirs(args.soft_links_dir, exist_ok=True)

    # Check if the extra crawled files directory exists if specified
    if args.extra_crawled_files_dir:
        if not os.path.exists(args.extra_crawled_files_dir):
            raise ValueError('Extra crawled files directory does not exist')
        colored_htmls_save_dir = args.extra_crawled_files_dir
    else:
        # Default save directory for colored HTMLs based on the sorted links output directory
        colored_htmls_save_dir = os.path.dirname(args.sorted_links_output_dir.rstrip('/'))
        os.makedirs(colored_htmls_save_dir, exist_ok=True)

    # Split languages and sizes into lists for processing
    langs = args.langs.split(',')
    side_contexts_sizes = args.side_contexts_sizes.split(',')

    # Validate existence of scored data files for each language and size
    for lang in langs:
        for size in side_contexts_sizes:
            scored_file_path = f"{args.scored_data_dir}/{lang}_{size}_{args.full_model_name}_scored.parquet"
            if not os.path.exists(scored_file_path):
                raise ValueError(f"{scored_file_path} does not exist")

    # Determine the relative save folder based on soft links or colored HTMLs
    if args.soft_links_dir:
        common_pref = os.path.commonprefix([args.soft_links_dir, args.sorted_links_output_dir])
        common_pref = os.path.dirname(common_pref)
        rel_save_folder = os.path.relpath(args.soft_links_dir, common_pref)
    else:
        common_pref = os.path.commonprefix([colored_htmls_save_dir, args.sorted_links_output_dir])
        common_pref = os.path.dirname(common_pref)
        rel_save_folder = os.path.relpath(colored_htmls_save_dir, common_pref)

    # Process each language and context size
    for lang in langs:
        for size in side_contexts_sizes:
            print(f'Processing language {lang} with side contexts size {size}')
            links_page_path = f"{colored_htmls_save_dir}/{lang}"
            
            # Load the scored data from parquet file
            scored_data = pd.read_parquet(f"{args.scored_data_dir}/{lang}_{size}_{args.full_model_name}_scored.parquet")
            
            # Skip processing if there are no scored data entries
            if scored_data.shape[0] == 0:
                continue

            # Initialize a dictionary to store paths by missing category
            paths_dict = {missing_category: [] for missing_category in scored_data['missing_category'].unique()}

            # Create directories for colored pages if extra crawled files are not specified
            if not args.extra_crawled_files_dir:
                for missing_category, source_ID, first_version, link_text, source_title, target_title in zip(
                    scored_data['missing_category'], 
                    scored_data['source_ID'], 
                    scored_data['first_version'], 
                    scored_data['link_text'], 
                    scored_data['source_title'], 
                    scored_data['target_title']
                ):
                    colored_page_folder = f"{links_page_path}/{source_ID}_{first_version}"
                    os.makedirs(colored_page_folder, exist_ok=True)

            # Populate paths_dict with relative links based on missing categories
            for missing_category, source_ID, first_version, link_text, source_title, target_title in zip(
                scored_data['missing_category'], 
                scored_data['source_ID'], 
                scored_data['first_version'], 
                scored_data['link_text'], 
                scored_data['source_title'], 
                scored_data['target_title']
            ):
                rel_colored_page_folder = f"../{rel_save_folder}/{lang}/{source_ID}_{first_version}"
                if args.soft_links_dir:
                    # Create a soft link entry
                    paths_dict[missing_category].append({
                        f"{source_title} --> {target_title}": f"{rel_colored_page_folder}/symlink_{size}_{compute_md5(link_text)}"
                    })
                else: 
                    # Create a normal link entry
                    paths_dict[missing_category].append({
                        f"{source_title} --> {target_title}": f"{rel_colored_page_folder}/{size}_{compute_md5(link_text)}_index.html#start-point"
                    })
               
            # Determine the path for the raw HTML file
            first_row = scored_data.iloc[0]
            potential_raw_html_file_path = f"{args.html_dir}/{lang}/{first_row['source_ID']}_{first_row['first_version']}.html"

            if os.path.exists(potential_raw_html_file_path):
                raw_html_file_path = f"{args.html_dir}/{lang}"
            else:
                raw_html_file_path = f"{args.html_dir}/{lang}wiki-NS0-20231001"

            # Run the colouring pipeline to process the scored data and generate colored HTML
            colouring_pipeline(
                scored_data,
                links_page_path,
                raw_html_file_path,
                size
            )

            # Convert paths dictionary to HTML format
            html_path_dict = dict_to_html_list(paths_dict)
            
            # If soft links are enabled, create them for each missing category
            if args.soft_links_dir:
                for missing_category, source_ID, first_version, link_text, source_title, target_title in zip(
                    scored_data['missing_category'], 
                    scored_data['source_ID'], 
                    scored_data['first_version'], 
                    scored_data['link_text'], 
                    scored_data['source_title'], 
                    scored_data['target_title']
                ):
                    soft_link_rel_colored_page_folder = f"{args.soft_links_dir}/{lang}/{source_ID}_{first_version}"
                    soft_link_src_pg = f"{links_page_path}/{source_ID}_{first_version}/{size}_{compute_md5(link_text)}_index.html#start-point"
                    soft_link_tgt = f"{soft_link_rel_colored_page_folder}/symlink_{size}_{compute_md5(link_text)}"
                    
                    print(f"Creating softlink of {soft_link_src_pg} in {soft_link_tgt}")
                    os.makedirs(soft_link_rel_colored_page_folder, exist_ok=True)
                    if os.path.exists(soft_link_tgt):
                        os.remove(soft_link_tgt)  # Remove existing symlink if it exists
                    os.symlink(soft_link_src_pg, soft_link_tgt)  # Create the new symlink

            # Save the generated HTML to the output directory
            with open(f"{args.sorted_links_output_dir}/{lang}_{size}.html", 'w', encoding='utf-8') as f:
                f.write(html_path_dict)