import argparse
import pandas as pd
import numpy
from transformers import AutoModel, AutoTokenizer
import torch
import torch.nn as nn
import sys
import os
from urllib import parse
from tqdm import tqdm
import random
from glob import glob
from ast import literal_eval

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))


def fix_title(title):
    return parse.unquote(title).replace('_', ' ')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data_dir', type=str,
                        required=True, help='Path to data directory')
    parser.add_argument('--langs', type=str, nargs='+', required=True,
                        help='Languages to benchmark')
    parser.add_argument('--models_dir', type=str, required=True,
                        help='Directory containing model directories')
    parser.add_argument('--column_name', type=str, required=True,
                        help='Name of column to add to dataframe')
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
    parser.add_argument('--pointwise_loss', action='store_true', help='Use model trained with pointwise loss')
    parser.set_defaults(use_section_title=False, use_mentions=False,
                        use_cuda=False, only_multilingual=False)

    args = parser.parse_args()

    # check if data path exists
    if not os.path.exists(args.data_dir):
        raise ValueError('Data directory does not exist')
    # check if models dir exists
    if not os.path.exists(args.models_dir):
        raise ValueError('Models directory does not exist')

    output_dimension = 2 if args.pointwise_loss else 1

    # process each language sequentially
    for lang in args.langs:
        print('Processing language', lang)
        models = {}
        if os.path.exists(os.path.join(args.models_dir, args.models_prefix + '_' + lang)) and not args.only_multilingual:
            models[lang] = {}
            models[lang]['model'] = AutoModel.from_pretrained(
                os.path.join(args.models_dir, args.models_prefix + '_' + lang, 'model'))
            models[lang]['model'].eval()
            models[lang]['classification_head'] = nn.Sequential(nn.Linear(models[lang]['model'].config.hidden_size, models[lang]['model'].config.hidden_size),
                                                                nn.ReLU(),
                                                                nn.Linear(models[lang]['model'].config.hidden_size, output_dimension))
            models[lang]['classification_head'].load_state_dict(torch.load(
                os.path.join(args.models_dir, args.models_prefix + '_' + lang, 'classification_head.pth'), map_location='cpu'))
            models[lang]['classification_head'].eval()
            models[lang]['tokenizer'] = AutoTokenizer.from_pretrained(
                os.path.join(args.models_dir, args.models_prefix + '_' + lang, 'tokenizer'))
        if os.path.exists(os.path.join(args.models_dir, args.models_prefix + '_' + args.multilingual_name)):
            models[args.multilingual_name] = {}
            models[args.multilingual_name]['model'] = AutoModel.from_pretrained(
                os.path.join(args.models_dir, args.models_prefix + '_' + args.multilingual_name, 'model'))
            models[args.multilingual_name]['model'].eval()
            models[args.multilingual_name]['classification_head'] = nn.Sequential(nn.Linear(models[args.multilingual_name]['model'].config.hidden_size, models[args.multilingual_name]['model'].config.hidden_size),
                                                                          nn.ReLU(),
                                                                          nn.Linear(models[args.multilingual_name]['model'].config.hidden_size, output_dimension))
            models[args.multilingual_name]['classification_head'].load_state_dict(torch.load(
                os.path.join(args.models_dir, args.models_prefix + '_' + args.multilingual_name, 'classification_head.pth'), map_location='cpu'))
            models[args.multilingual_name]['classification_head'].eval()
            models[args.multilingual_name]['tokenizer'] = AutoTokenizer.from_pretrained(
                os.path.join(args.models_dir, args.models_prefix + '_' + args.multilingual_name, 'tokenizer'))
        
        if len(models) == 0:
            raise ValueError('No models found')

        if args.use_cuda:
            for model_lang in models:
                models[model_lang]['model'] = models[model_lang]['model'].to(
                    'cuda' if torch.cuda.is_available() else 'cpu')
                models[model_lang]['classification_head'] = models[model_lang]['classification_head'].to(
                    'cuda' if torch.cuda.is_available() else 'cpu')

        df = pd.read_parquet(os.path.join(args.data_dir, f'{lang}.parquet'))

        target_titles = df['target_title'].apply(fix_title).tolist()
        target_leads = df['target_lead'].tolist()
        contexts = [[] for _ in range(len(df))]
        source_sections = [[] for _ in range(len(df))]
        for i, (pos_context, section) in enumerate(zip(df['context'].tolist(), df['section'].tolist())):
            contexts[i].append(pos_context)
            source_sections[i].append(section)
        for i, neg_contexts in enumerate(df['negative_contexts'].tolist()):
            neg_contexts = literal_eval(neg_contexts)
            for context in neg_contexts:
                contexts[i].append(context['context'])
                source_sections[i].append(context['section'])

        mention_map_pre = pd.read_parquet(os.path.join(
            args.data_dir, f'{lang}_mention_map.parquet'))
        mention_map_pre = mention_map_pre.to_dict('records')
        mention_map = {}
        for row in mention_map_pre:
            title = fix_title(row['target_title'])
            if title in mention_map:
                mention_map[title].append(row['mention'])
            else:
                mention_map[title] = [row['mention']]

        for title in mention_map:
            mention_map[title] = list(set([mention.lower() for mention in mention_map[title]]))
            if len(mention_map[title]) > 10:
                mention_map[title].sort(key=lambda x: len(x))
                while len(mention_map[title]) > 10 and len(mention_map[title][0]) < 3:
                    mention_map[title].pop(0)
                mention_map[title] = mention_map[title][:10]
                random.shuffle(mention_map[title])
            mention_map[title] = ' '.join(mention_map[title])

        rank = {model_lang: [] for model_lang in models}
        with torch.no_grad():
            for context, source_section, target_title, target_lead in tqdm(zip(contexts, source_sections, target_titles, target_leads), total=len(target_titles)):
                if target_title not in mention_map:
                    mention_map[target_title] = ''
                for model_lang in models:
                    scores = []
                    inputs = []
                    for c, s in zip(context, source_section):
                        input = ["", ""]
                        if args.use_mentions:
                            input[0] = f"{target_title} {mention_map[target_title]}{models[model_lang]['tokenizer'].sep_token}{target_lead}"
                        else:
                            input[0] = f"{target_title}{models[model_lang]['tokenizer'].sep_token}{target_lead}"
                        if args.use_section_title:
                            input[1] = f"{s}{models[model_lang]['tokenizer'].sep_token}"
                        input[1] += f"{c}"
                        inputs.append(input)
                        if len(inputs) == 12:
                            input_tokens = models[model_lang]['tokenizer'](inputs, return_tensors='pt', padding='max_length',
                                                                           truncation=True, max_length=512).to('cuda' if torch.cuda.is_available() and args.use_cuda else 'cpu')
                            embeddings = models[model_lang]['model'](
                                **input_tokens)['last_hidden_state'][:, 0, :]
                            prediction = models[model_lang]['classification_head'](
                                embeddings).squeeze()
                            if (len(prediction.shape) == 0 and not args.pointwise_loss) or (len(prediction.shape) == 1 and args.pointwise_loss):
                                prediction = prediction.unsqueeze(0)
                            for score in prediction:
                                if args.pointwise_loss:
                                    scores.append(score[1].item())
                                else:                                
                                    scores.append(score.item())
                            inputs = []
                    if len(inputs) > 0:
                        input_tokens = models[model_lang]['tokenizer'](inputs, return_tensors='pt', padding='max_length',
                                                                       truncation=True, max_length=512).to('cuda' if torch.cuda.is_available() and args.use_cuda else 'cpu')
                        embeddings = models[model_lang]['model'](
                            **input_tokens)['last_hidden_state'][:, 0, :]
                        prediction = models[model_lang]['classification_head'](
                            embeddings).squeeze()
                        if (len(prediction.shape) == 0 and not args.pointwise_loss) or (len(prediction.shape) == 1 and args.pointwise_loss):
                            prediction = prediction.unsqueeze(0)
                        for score in prediction:
                            if args.pointwise_loss:
                                scores.append(score[1].item())
                            else:
                                scores.append(score.item())
                    print(scores)
                    position = 1
                    for i, score in enumerate(scores[1:]):
                        if score > scores[0]:
                            position += 1
                    rank[model_lang].append(position)

        for model_lang in rank:
            df[f'{args.column_name}_{model_lang}'] = rank[model_lang]
        df.to_parquet(os.path.join(args.data_dir, f'{lang}.parquet'))