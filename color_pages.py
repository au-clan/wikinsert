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



HEAT_MAP_UTIL = 'js_parsing/heatmap_utils.js'
HEAT_MAP_BUILDER = 'overlayHeatMap'

with open (HEAT_MAP_UTIL, "r") as f:
    heat_map_util = f.read()

heat_map_util_compiled = execjs.compile(heat_map_util)

def dict_to_html_list(data):
    html = '<ul>'
    for category, urls in data.items():
        html += f'<li>{category}: <ul>'
        for url_dict in urls:
            for url_title, url in url_dict.items():
                html += f'<li><a href="{url}" target="_blank">{url_title}</a></li>'
        html += '</ul></li>'
    html += '</ul>'
    return html


def compute_md5(input_string):
    # Create an md5 hash object
    md5_hash = hashlib.md5()
    
    # Encode the input string to bytes and update the hash object
    md5_hash.update(input_string.encode('utf-8'))
    
    # Return the hexadecimal representation of the hash
    return md5_hash.hexdigest()


def normalize_scores(scores, smoothing_param):
    min_ = np.min(scores)
    nm_scores = scores - min_
    max_ = np.max(nm_scores)
    if max_ == 0:
        return [1.0 for _ in nm_scores]
    nm_scores = nm_scores / np.max(nm_scores)

    return nm_scores ** (1/smoothing_param)

def black_to_red(scores, smoothing_param):
    scores = normalize_scores(scores, smoothing_param)
    #sns.color_palette("coolwarm", as_cmap=True)
    colors = [(0.0,1.0,score) for score in scores]
    colors = [mcolors.hsv_to_rgb(color)*255 for color in colors]
    colors = [(color[0], color[1], color[2], 255) for color in colors]
    return colors

def blue_to_red(scores, smoothing_param):
    scores = normalize_scores(scores, smoothing_param) #scores between 0 and 1
    palette = sns.color_palette("coolwarm", as_cmap=True)
    colors = palette(scores)
    colors = [(color[0]*255, color[1]*255, color[2]*255, 255) for color in colors]
    return colors

def grey_to_red(scores, smoothing_param):
    scores = normalize_scores(scores, smoothing_param)
    palette = sns.color_palette(palette='blend:gray,r', as_cmap=True)
    colors = palette(scores)
    colors = [(color[0]*255, color[1]*255, color[2]*255, (score+ 0.3)/4) for score,color in zip(scores,colors)]
    return colors

def color_contexts(contexts, coloring_func, smoothing_param):
    '''Color contexts
    input:
        contexts: list of dictionaries with key 'normalized_score' (and others)
        coloring_func: function that takes a list of scores and returns a list of colors in fromat [(int,int,int)]
    output:
        contexts: list of dictionaries with key and 'score' and 'normalized_score' and 'color' (and others)'''
    colors = coloring_func([context['score'] for context in contexts], smoothing_param) 
    for context,color in zip(contexts,colors):
        try:
            context['color'] = int(color[0]), int(color[1]), int(color[2]), color[3]
        except ValueError as e:
            print(color)
            raise e

    return contexts

def overlay_heatmap(colored_contexts, source_ID, first_version, missing_category, insert_indices, moved_insertion_marker, link_text, link_sentence, html_folder_path, save_folder, context_size):
    color_store = get_color_store(colored_contexts, missing_category, insert_indices, moved_insertion_marker, link_sentence, link_text)
    save_folder_page = f"{save_folder}/{source_ID}_{first_version}"

    if not os.path.exists(save_folder_page):
        raise ValueError(f'Folder {save_folder_page} does not exist')
    
    raw_html_file_path = f"{html_folder_path}/{source_ID}_{first_version}.html"
    
    output_path = f"{save_folder_page}/{context_size}_{compute_md5(link_text)}_index.html"

    heat_map_util_compiled.call(HEAT_MAP_BUILDER, color_store, raw_html_file_path, output_path)

def colouring_pipeline(df, save_folder, html_folder_path, context_size, styles_coloring_funcs_pairs = [('highlight', grey_to_red)], smoothing_params = [1], overlaying_func = overlay_heatmap):
    '''Color contexts with different styles
    input:
        df: dataframe with columns 'contexts'
        styles: list of strings, styles of the text (options: 'text', 'background', 'highlight')
        coloring_funcs: list of functions that take a list of scores and return a list of colors in fromat [(int,int,int)]
        show_gt: bool, whether to highlight contexts marked as correct
    output:
        nothing, saves html files in save_folder'''

    for style, coloring_func in styles_coloring_funcs_pairs:
        print(f'Coloring with {coloring_func.__name__}')
        for smoothing_param in smoothing_params:
            print(f'Smoothing param: {smoothing_param}')
            df['all_contexts'] = df['all_contexts'].progress_apply(lambda x: color_contexts(x, coloring_func, smoothing_param))
            print(f'Style: {style}')

            df.progress_apply(lambda x: overlaying_func(x['all_contexts'],
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
                                                        ), axis = 1)


def get_html_paths(data_path, scored_df):
    data_path_in = f"{data_path}"
    paths = scored_df.progress_apply(lambda x: f"{data_path_in}/{x['source_ID']}_{x['first_version']}.html", axis=1)

    return paths

def get_color_store(contexts, missing_category, insert_index, moved_insertion_marker, link_sentence, link_text):
    color_store = []
    one_special = False

    if all([i == j for i, j in zip([-1], insert_index)]):
        if missing_category not in ['missing_sentence', 'missing_span']:
            raise ValueError('Insert index not found')
        
        first_llist = contexts[0]['middle_sentence']['locList1'] 
        first_color = contexts[0]['color']
        color_store.append({
                'start': first_llist[0]['start'],
                'end': first_llist[0]['start'],
                'color': first_color,
                'special': True,
                'sentence_end': 0,
                'missing_category': missing_category,
                'link_sentence_parts': link_sentence.split(link_text,1),
                'link_text': link_text,
                'last': True
            })
        one_special = True


    for context in contexts:
        middle_sentence = context['middle_sentence']
        indexes = middle_sentence['ids1']
        llist = middle_sentence['locList1']
        sent_end = middle_sentence['endIdx1']
        special = all([i == j for i, j in zip(indexes, insert_index)])
        if not special:
            for lindexes in llist:
                loc = {
                    'start': lindexes['start'],
                    'end': lindexes['end'],
                    'color': context['color'],
                    'special': False,
                    'sentence_end': sent_end,
                    'missing_category': missing_category
                }
                color_store.append(loc)
        else:
            one_special = True
            if missing_category == 'missing_sentence' or missing_category == 'missing_span':
                for lindexes in llist[:-1]:
                    loc = {
                        'start': lindexes['start'],
                        'end': lindexes['end'],
                        'color': context['color'],
                        'special': False,
                        'sentence_end': sent_end,
                        'missing_category': missing_category
                    }
                    color_store.append(loc)

                color_store.append({
                    'start': llist[-1]['start'],
                    'end': llist[-1]['end'],
                    'color': context['color'],
                    'special': True,
                    'sentence_end': sent_end,
                    'missing_category': missing_category,
                    'link_sentence_parts': link_sentence.split(link_text,1),
                    'link_text': link_text,
                    'last': True
                })

            if missing_category in ['missing_mention', 'missing_mention_in_moved_sentence']:
                for lindexes in llist[:-1]:
                    loc = {
                        'start': lindexes['start'],
                        'end': lindexes['end'],
                        'color': context['color'],
                        'special': True,
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
                    'sentence_end': sent_end,
                    'missing_category': missing_category,
                    'last': True,
                    'link_text': link_text,
                })

               
            if missing_category in ['missing_mention_with_sentence_modifications','missing_mention_in_moved_sentence_with_modifications']:
                if link_text in middle_sentence['clean_sentence']:
                    for lindexes in llist[:-1]:
                        loc = {
                            'start': lindexes['start'],
                            'end': lindexes['end'],
                            'color': context['color'],
                            'special': True,
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
                            'sentence_end': sent_end,
                            'missing_category': missing_category,
                            'last': False
                        }
                        color_store.append(loc)


                    new_sentence_parts = middle_sentence['clean_sentence2'].split(link_text,1)

                    color_store.append({
                        'start': llist[-1]['start'],
                        'end': llist[-1]['end'],
                        'color': context['color'],
                        'special': True,
                        'sentence_end': sent_end,
                        'missing_category': missing_category,
                        'last': True,
                        'new_sentence_parts': new_sentence_parts,
                        'link_text': link_text,
                    })

        if moved_insertion_marker:
            marker = all([i == j for i, j in zip(indexes, moved_insertion_marker)])

            if marker:
                loc = {
                    'start': llist[-1]['start'],
                    'end': llist[-1]['start'],
                    'color': context['color'],
                    'sentence_end': sent_end,
                    'special': True,
                    'missing_category': 'marker'
                }
                color_store.append(loc)

    if not one_special:
        raise ValueError('No special context found')

    return color_store


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--scored_data_dir', type=str,
                        required=True, help='Path to scored data directory')
    parser.add_argument('--html_dir', type=str,
                        required=True, help='Path to raw html directory')
    parser.add_argument('--files_link_output_dir', type=str,
                        required=True, help='Path to output directory')
    parser.add_argument('--langs', type=str, nargs='+', required=True,
                        help='Languages to benchmark')
    parser.add_argument('--side_contexts_sizes', type=str, nargs='+', required=True,
                        help='Size of side contexts to benchmark')
    parser.add_argument('--extra_crawled_files_dir', type=str, required=False, default=None)

    args = parser.parse_args()
    # check if data path exists
    
    if not os.path.exists(args.html_dir):
        raise ValueError('HTML directory does not exist')
    
    if not os.path.exists(args.files_link_output_dir):
        os.makedirs(args.files_link_output_dir, exist_ok=True)
    
    if args.extra_crawled_files_dir:
        if not os.path.exists(args.extra_crawled_files_dir):
            raise ValueError('Extra crawled files directory does not exist')
        colored_htmls_save_dir = args.extra_crawled_files_dir
    else:
        colored_htmls_save_dir = os.path.dirname(args.files_link_output_dir.rstrip('/'))
        os.makedirs(colored_htmls_save_dir, exist_ok=True)


    for lang in args.langs:
        for size in args.side_contexts_sizes:
            if not os.path.exists(f"{args.scored_data_dir}/{lang}_{size}_scored.parquet"):
                raise ValueError('Scored data directory does not exist')
    
    
    common_pref = os.path.commonprefix([colored_htmls_save_dir, args.files_link_output_dir])
    common_pref = os.path.dirname(common_pref)
    rel_save_folder = os.path.relpath(colored_htmls_save_dir, common_pref)


    for lang in args.langs:
        for size in args.side_contexts_sizes:
            print(f'Processing language {lang} with side contexts size {size}')
            links_page_path = f"{colored_htmls_save_dir}/{lang}"

            scored_data = pd.read_parquet(f"{args.scored_data_dir}/{lang}_{size}_scored.parquet")

            paths_dict = {missing_catgory : [] for missing_catgory in scored_data['missing_category'].unique()}

            if not args.extra_crawled_files_dir:
                
                for missing_catgory, source_ID, first_version, link_text, source_title, target_title in zip(scored_data['missing_category'], scored_data['source_ID'], scored_data['first_version'], scored_data['link_text'], scored_data['source_title'], scored_data['target_title']):
                    colored_page_folder = f"{links_page_path}/{source_ID}_{first_version}"
                    os.makedirs(colored_page_folder, exist_ok=True)
                    
            rel_save_dir = os.path.join(rel_save_folder, lang)

            for missing_catgory, source_ID, first_version, link_text, source_title, target_title in zip(scored_data['missing_category'], scored_data['source_ID'], scored_data['first_version'], scored_data['link_text'], scored_data['source_title'], scored_data['target_title']):
                rel_colored_page_folder = f"../{rel_save_dir}/{source_ID}_{first_version}"
                paths_dict[missing_catgory].append({f"{source_title} --> {target_title}" : f"{rel_colored_page_folder}/{size}_{compute_md5(link_text)}.html"})

            first_row = scored_data.iloc[0]
            potential_raw_html_file_path = f"{args.html_dir}/{lang}/{first_row['source_ID']}_{first_row['first_version']}.html"

            if os.path.exists(potential_raw_html_file_path):
                raw_html_file_path = f"{args.html_dir}/{lang}"
            else:
                raw_html_file_path = f"{args.html_dir}/{lang}wiki-NS0-20231001"

            colouring_pipeline(
                scored_data,
                links_page_path,
                raw_html_file_path,
                size
            )

            html_path_dict = dict_to_html_list(paths_dict)
            
            #save the html
            with open(f"{args.files_link_output_dir}/{lang}_{size}.html", 'w') as f:
                f.write(html_path_dict)