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
            context['color'] = int(color[0]), int(color[1]), int(color[2]), int(color[3])
        except ValueError as e:
            print(color)
            raise e

    return contexts

def dummy_input_colors(contexts, style='text', show_gt=True):
    '''Input colors in HTML with different styles
    input:
        contexts: list of dictionaries (in correct order) with keys 'color' (r,g,b) as 0->255 ints and 'clean sentence'
        style: string, style of the text (options: 'text', 'background', 'highlight')
        highlight_gt: bool, whether to highlight contexts marked as correct
    output:
        html: dummy HTML string with text colors
    '''

    # Define the formating style based on the input 'style'
    if style == 'text':
        format  = '<span style="color: rgb({r}, {g}, {b});">{sentence}</span> '
    elif style == 'background':
        format  = '<span style="background-color: rgb({r}, {g}, {b})">{sentence}</span> '
    elif style == 'highlight':
        format  = '<span style="background-color: rgba({r}, {g}, {b}, 0.35);">{sentence}</span>'


    # Create html string with colors and specified style
    html = ''
    for context in contexts:
        r, g, b = context["color"]
        sentence = context["middle_sentence"]["clean_sentence"]
        if show_gt and context['correct']:
            html += '<span style="border: 3px solid red; padding: 2px;">'
            html += format.format(r=int(r), g=int(g), b=int(b), sentence=sentence)
            html += '</span>'
        else:
            html += format.format(r=int(r), g=int(g), b=int(b), sentence=sentence)
    return html

def overlay_heatmap(colored_contexts, source_ID, first_version, missing_category, insert_indices, html_folder_path, lang, save_folder, style):
    color_store = get_color_store(colored_contexts, missing_category, insert_indices)
    file_path = f"{html_folder_path}/{lang}wiki-NS0-20231001/eval/pages/{source_ID}_{first_version}.html"
    output_path = f"{save_folder}/{source_ID}_{first_version}_{missing_category}_{style}.html"


    heat_map_util_compiled.call(HEAT_MAP_BUILDER, color_store,  style, file_path, output_path)

def colouring_pipeline(df, save_folder, html_folder_path, lang, styles_coloring_funcs_pairs = [('highlight', blue_to_red), ('text', black_to_red)], smoothing_params = [1], overlaying_func = overlay_heatmap):
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
            save_folder_= f'{save_folder}/{coloring_func.__name__}_{style}_smoothing_{smoothing_param}'
            if not os.path.exists(save_folder_):
                os.makedirs(save_folder_)
            df.progress_apply(lambda x: overlaying_func(x['all_contexts'],
                                                        x['source_ID'],
                                                        x['first_version'],
                                                        x['missing_category'],
                                                        x['insert_indices'],
                                                        html_folder_path,
                                                        lang,
                                                        save_folder_,
                                                        style), axis = 1)


def get_html_paths(data_path, lang, scored_df):
    data_path_in = f"{data_path}/{lang}wiki-NS0-20231001/eval/pages"
    paths = scored_df.progress_apply(lambda x: f"{data_path_in}/{x['source_ID']}_{x['first_version']}.html", axis=1)

    return paths

def get_color_store(contexts, missing_category, insert_index):
    color_store = []
    
    for context in contexts:
        middle_sentence = context['middle_sentence']
        indexes = middle_sentence['ids1']
        llist = middle_sentence['locList1']
        
        special = all([i == j for i, j in zip(indexes, insert_index)])
        specials = [False] * len(llist)
        if special:
            if missing_category == 'missing_mention':
                specials = [True] * len(llist) 
            else:
                specials = [False] * (len(llist) - 1)
                specials.append(True)

        for i,loc in enumerate(llist):
            loc['color'] = context['color']
            loc['special'] = specials[i]
            loc['type'] = missing_category
            color_store.append(loc)
    return color_store



if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--scored_data_dir', type=str,
                        required=True, help='Path to scored data directory')
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
            print(f'Processing language {lang} with side contexts size {size}')
            scored_data = pd.read_parquet(f"{args.scored_data_dir}/{lang}_{size}_scored.parquet")
            scored_data['contexts'] = scored_data['contexts'].progress_apply(softmax_scores, desc='Normalizing scores')
            scored_data['contexts'] = scored_data['contexts'].progress_apply(color_contexts, desc='Computing colors')
            scored_data['html'] = scored_data.progress_apply(lambda x: input_colors(x['contexts'], x['html']), axis=1)
            scored_data.to_parquet(f"{args.scored_data_dir}/{lang}_{size}_scored_colored.parquet")
            print(f'Processed language {lang} with side contexts size {size}')