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

HEAT_MAP_UTIL = 'js_parsing/heatmap_utils.js'
HEAT_MAP_BUILDER = 'overlayHeatMap'

with open (HEAT_MAP_UTIL, "r") as f:
    heat_map_util = f.read()

heat_map_util_compiled = execjs.compile(heat_map_util)

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

def overlay_heatmap(colored_contexts, source_ID, first_version, missing_category, insert_indices, moved_insertion_marker, link_text, link_sentence, html_folder_path, lang, save_folder, style):
    if not os.path.exists(save_folder):
        os.makedirs(save_folder)
    color_store = get_color_store(colored_contexts, missing_category, insert_indices, moved_insertion_marker, link_sentence, link_text)
    file_path = f"{html_folder_path}/{source_ID}_{first_version}.html"
    output_path = f"{save_folder}/{source_ID}_{first_version}_{link_text.replace('/', '')}.html"

    heat_map_util_compiled.call(HEAT_MAP_BUILDER, color_store, file_path, output_path)

def colouring_pipeline(df, save_folder, html_folder_path, lang, styles_coloring_funcs_pairs = [('highlight', grey_to_red)], smoothing_params = [1], overlaying_func = overlay_heatmap):
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
            save_folder_= f'{save_folder}' + '/{missing_category}' #+f'{coloring_func.__name__}_{style}_smoothing_{smoothing_param}'
            df.progress_apply(lambda x: overlaying_func(x['all_contexts'],
                                                        x['source_ID'],
                                                        x['first_version'],
                                                        x['missing_category'],
                                                        x['insert_indices'],
                                                        x['moved_insertion_marker'],
                                                        x['link_text'],
                                                        x['link_sentence'],
                                                        html_folder_path,
                                                        lang,
                                                        save_folder_.format(missing_category = x['missing_category']),
                                                        style), axis = 1)


def get_html_paths(data_path, lang, scored_df):
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
    parser.add_argument('--output_dir', type=str,
                        required=True, help='Path to output directory')
    parser.add_argument('--langs', type=str, nargs='+', required=True,
                        help='Languages to benchmark')
    parser.add_argument('--side_contexts_sizes', type=str, nargs='+', required=True,
                        help='Size of side contexts to benchmark')

    args = parser.parse_args()
    # check if data path exists
    if not os.path.exists(args.scored_data_dir):
        raise ValueError('Data directory does not exist')
    # check if models dir exists

    for lang in args.langs:
        for size in args.side_contexts_sizes:
            if not os.path.exists(f"{args.scored_data_dir}/{lang}_{size}_scored.parquet"):
                raise ValueError('Scored data directory does not exist')
    
    for lang in args.langs:
        for size in args.side_contexts_sizes:
            save_folder = f"{args.output_dir}/{lang}_{size}"
            os.makedirs(save_folder, exist_ok=True)

            print(f'Processing language {lang} with side contexts size {size}')
            scored_data = pd.read_parquet(f"{args.scored_data_dir}/{lang}_{size}_scored.parquet")
            colouring_pipeline(
                scored_data,
                save_folder,
                args.html_dir,
                lang
            )
            