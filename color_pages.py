from calendar import c
from numpy import argsort
import pandas as pd
import numpy as np
import argparse
from bs4 import BeautifulSoup, Comment, MarkupResemblesLocatorWarning
import re
import urllib
import difflib
from nltk import sent_tokenize
import math
from tqdm import tqdm
import os
import warnings
from multiprocessing import Pool, cpu_count
import json
import weasyprint
from scipy.special import softmax
import string
import matplotlib.colors as mcolors
import seaborn as sns
tqdm.pandas()

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
    return colors

def blue_to_red(scores, smoothing_param):
    scores = normalize_scores(scores, smoothing_param) #scores between 0 and 1
    palette = sns.color_palette("coolwarm", as_cmap=True)
    colors = palette(scores)
    colors = [(color[0]*255,color[1]*255, color[2]*255) for color in colors]
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
            context['color'] = int(color[0]), int(color[1]), int(color[2])
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

def dummy_colouring_pipeline(df, save_folder, styles=['text','background','highlight'], coloring_funcs = [blue_to_red, black_to_red], smoothing_params = [0.25,1,4.0] ,show_gt=True):
    '''Color contexts with different styles
    input:
        df: dataframe with columns 'contexts' and 'html'
        styles: list of strings, styles of the text (options: 'text', 'background', 'highlight')
        coloring_funcs: list of functions that take a list of scores and return a list of colors in fromat [(int,int,int)]
        show_gt: bool, whether to highlight contexts marked as correct
    output:
        nothing, saves html files in save_folder'''
    
    for coloring_func in coloring_funcs:
        print(f'Coloring with {coloring_func.__name__}')
        for smoothing_param in smoothing_params:
            print(f'Smoothing param: {smoothing_param}')
            df['all_contexts'] = df['all_contexts'].progress_apply(lambda x: color_contexts(x, coloring_func, smoothing_param))
            for style in styles:
                print(f'Style: {style}')
                htmls = df['all_contexts'].progress_apply(lambda x: dummy_input_colors(x, style=style, show_gt=show_gt))
                #create folder if it does not exist
                if not os.path.exists(f'{save_folder}/{coloring_func.__name__}_{style}_smoothing_{smoothing_param}'):
                    os.makedirs(f'{save_folder}/{coloring_func.__name__}_{style}_smoothing_{smoothing_param}')
                for i,html in tqdm(enumerate(htmls), total=len(htmls), desc='Saving HTMLs'):
                    with open(f'{save_folder}/{coloring_func.__name__}_{style}_smoothing_{smoothing_param}/number_{i}.html', 'w', encoding='utf-8') as file:
                        file.write(html)

        

def get_word_position(sentence, file_text):
    #split sentence, punctutation should be also used to split
    word_list = re.findall(r"[\d]{1}|[\w']+|[.,!?;]", sentence)
    #patterns = [f'\\b{word}\\b' for word in word_list]
    patterns = [f'\\b{word}\\b' if word not in string.digits else word for word in word_list if word not in string.punctuation]
    word_list = [word for word in word_list if word not in string.punctuation]
    word_positions = {word: [match.start() for match in re.finditer(pattern, file_text)]  for word,pattern in zip(word_list,patterns)}
    
    return word_positions, word_list

def find_min_span(word_positions, word_list):
    if len(word_list) == 1:
        return word_positions[word_list[0]][0], word_positions[word_list[0]][0] + len(word_list[0])
    
    span = [None]*len(word_list)
    #print(word_list)
    #print(word_positions)
    start_list = list(filter(lambda x: x < word_positions[word_list[1]][0], word_positions[word_list[0]]))
    if start_list == []:
        #print(word_list)
        #print(word_positions)
        start = word_positions[word_list[0]][0]
    else:
        start = start_list[-1]
    span[0] = start

    for i,wd in enumerate(word_list[1:]):
        possible = list(filter(lambda x: x > span[i], word_positions[wd]))
        if possible == []:
            return None,None
        span[i+1] = possible[0]
        
    return span[0], span[-1] + len(word_list[-1])

    
def find_sentence_indices_in_text(html_all_text, sentence):
    start_index = html_all_text.lower().find(sentence)
    if start_index == -1:
        return None,None
    end_index = start_index + len(sentence)
    return start_index, end_index

def get_all_spans(contexts, html_path):
    '''Get all spans of contexts in html
    input:
        contexts: list of dictionaries with key and 'color' (and others)
        html_string: path to html
    output:
        contexts: list of dictionaries with key and 'color' and 'start_index', 'end_index' (and others)'''

    with open(html_path, 'r') as file:
        html_string = file.read()

    last_end = 0
    soup = BeautifulSoup(html_string, 'html.parser')
    all_text = soup.get_text()
    for context in contexts:
        clean_sentence = context['middle_sentence']['clean_sentence'].lower()
        start_index, end_index = find_sentence_indices_in_text(all_text[last_end:], clean_sentence)
        if start_index is not None:
            start_index += last_end
            end_index += last_end
        else:
            word_positions, word_list = get_word_position(clean_sentence, all_text[last_end:])
            word_list = [word for word in word_list if word_positions[word] != []]
            if word_list == []:
               start_index = last_end
               end_index = last_end
               #print(f"Words not found for {clean_sentence}")
               continue
            start_index,end_index = find_min_span(word_positions,word_list)
            if start_index is not None:
                start_index += last_end
                end_index += last_end
            else:
                super_clean_word_list = [word for word in word_list if len(word)>2 and word != 'title']
                #remove duplicates, keep second occurence
                super_clean_word_list = [super_clean_word_list[i] for i in range(len(super_clean_word_list)) if super_clean_word_list[i] not in super_clean_word_list[:i]]
                if super_clean_word_list == []:
                    #print(f"Words not found for {clean_sentence}")
                    start_index = last_end
                    end_index = last_end
                    continue
                start_index,end_index = find_min_span(word_positions,super_clean_word_list)
                if start_index is not None:
                    start_index += last_end
                    end_index += last_end
                else:
                    '''print(f"HTML to last_end:\n\n {all_text[:last_end]}\n================\n")
                    print(f"HTML from last_end:\n\n {all_text[last_end:]}\n================\n")
                    print(word_list)
                    print(super_clean_word_list)
                    print(word_positions)
                    print(context)
                    print(f"Could not find min span for super clean sentence:\n\n{super_clean_word_list} \n================\n")'''
                    start_index = None
                    end_index = None
                    return None 
                continue

        if end_index is not None:
            last_end = end_index
        context['start_index'] = start_index
        context['end_index'] = end_index
    return contexts

def get_html_paths(data_path, lang, scored_df):
    data_path_in = f"{data_path}/{lang}wiki-NS0-20231001/eval/pages"
    paths = scored_df.progress_apply(lambda x: f"{data_path_in}/{x['source_ID']}_{x['first_version']}.html", axis=1)

    return paths

def input_colors(contexts, html_path):
    '''Input colors in html
    input:
        contexts: list of dictionaries with key and 'color' (and others)
        html: html path
    output:
        html: html string with colors'''
    







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