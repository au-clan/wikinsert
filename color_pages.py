from calendar import c
from numpy import argsort
import pandas as pd
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
tqdm.pandas()

def softmax_scores(contexts):
    '''Normalize scores using softmax function
    input: 
        contexts: list of dictionaries with key and 'score' (and others)
    output:
        contexts: list of dictionaries with key and 'score' and 'normalized_score' (and others)'''
    
    scores = [context['score'] for context in contexts]
    normalized_scores = softmax(scores)
    for context, score in zip(contexts, normalized_scores):
        context['normalized_score'] = score
    
    return contexts
    

def get_color(normalized_score):
    '''Get color from normalized score
    input:
        normalized_score: float from 0 to 1
    output:
        color: vector of 3 integers from 0 to 255'''
    
    if normalized_score < 0.5:
        r = 255
        g = int(255 * 2 * normalized_score)
    else:
        r = int(255 * 2 * (1 - normalized_score))
        g = 255
    return [r, g, 0]

def color_contexts(contexts):
    '''Color contexts
    input:
        contexts: list of dictionaries with key 'normalized_score' (and others)
    output:
        contexts: list of dictionaries with key and 'score' and 'normalized_score' and 'color' (and others)'''
    
    for context in contexts:
        context['color'] = get_color(context['normalized_score'])
    return contexts
    

def input_colors(contexts, html_page):
    '''Color contexts
    input:
        contexts: list of dictionaries with key 'color' (and others)
        html_page: the html page containing these contexts

    output:
        colored_html_page: the html page with colored contexts'''
    
    soup = BeautifulSoup(html_page, 'html.parser')
    for context in contexts:
        color = context['color']
        for tag in soup.find_all(text=re.compile(context['context'])):
            tag.replace_with(tag.replace(context['context'], f'<span style="background-color:rgb({color[0]},{color[1]},{color[2]})">{context["context"]}</span>'))
    return str(soup)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data_dir', type=str,
                        required=True, help='Path to data directory')
    parser.add_argument('--output_dir', type=str,
                        required=True, help='Path to data directory')
    parser.add_argument('--langs', type=str, nargs='+', required=True,
                        help='Languages to benchmark')
    parser.add_argument('--side_contexts_sizes', type=str, nargs='+', required=True,
                        help='Size of side contexts to benchmark')
    parser.add_argument('--models_dir', type=str, required=True,
                        help='Directory containing model directories')
    parser.add_argument('--models_prefix', type=str,
                        required=True, help='Prefix of all models (sufix is language)')
    parser.add_argument('--use_section_title',
                        action='store_true', help='Use section title in input')
    parser.add_argument('--use_mentions', action='store_true',
                        help='Use mentions in input')
    parser.add_argument('--use_cuda', action='store_true',
                        help='Use cuda if available')
    parser.add_argument('--only_multilingual', action='store_true',
                        help='Only use multilingual model')
    parser.add_argument('--multilingual_name', type=str, default='multilingual', help='Suffix of multilingual model')
    parser.set_defaults(use_section_title=False, use_mentions=False,
                        use_cuda=False, only_multilingual=False)

    args = parser.parse_args()

    # check if data path exists
    if not os.path.exists(args.data_dir):
        raise ValueError('Data directory does not exist')
    # check if models dir exists
    if not os.path.exists(args.models_dir):
        raise ValueError('Models directory does not exist')

    output_dimension = 1

    batch_size = 64

    # process each language sequentially

    for lang in args.langs:
        print('Processing language', lang)
        models = {}
        if os.path.exists(os.path.join(args.models_dir, args.models_prefix + '_' + lang)) and not args.only_multilingual:
            models[lang] = {}
            models[lang]['model'] = AutoModel.from_pretrained(
                os.path.join(args.models_dir, args.models_prefix + '_' + lang, 'model'))
            models[lang]['tokenizer'] = AutoTokenizer.from_pretrained(
                os.path.join(args.models_dir, args.models_prefix + '_' + lang, 'tokenizer'))
        else:
            models[lang]