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

    batch_size = 12

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
        for model_lang in models:
            if args.use_cuda:
                for model_lang in models:
                    models[model_lang]['model'] = models[model_lang]['model'].to(
                        'cuda' if torch.cuda.is_available() else 'cpu')
                    models[model_lang]['classification_head'] = models[model_lang]['classification_head'].to(
                        'cuda' if torch.cuda.is_available() else 'cpu')
        
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

            for side_contexts_size in args.side_contexts_sizes:
                df = pd.read_parquet(os.path.join(args.data_dir, f'{lang}_{side_contexts_size}.parquet'))

                df['target_title'] = df['target_title'].apply(fix_title)
                
                df['idx'] = df.index
                df_contexts = df.explode('contexts')
                
                with torch.no_grad():
                    
                    for i in range(0, len(df), batch_size):
                        batch_df = df_contexts.iloc[i:i+batch_size]
                        batch_mention = mention_map[i:i+batch_size]

                        #use mention_map.get(tgt_title)

                        if args.use_mentions:
                            input0 = [f"{target_title} {mention_map.get(target_title, '')}{models[model_lang]['tokenizer'].sep_token}{target_lead}" 
                                    for target_title, target_lead in zip(batch_df['target_title'], batch_df['target_lead'])]
                        else:
                            input0 = [f"{target_title}{models[model_lang]['tokenizer'].sep_token}{target_lead}" 
                                    for target_title, target_lead in zip(batch_df['target_title'], batch_df['target_lead'])]

                        if args.use_section_title:
                            input1 = [f"{s}{models[model_lang]['tokenizer'].sep_token}{c}" for c, s in zip(batch_df['contexts'], batch_df['sections'])]
                        else:
                            input1 = batch_df['contexts']

                        inputs = list(zip(input0, input1))

                        input_tokens = models[model_lang]['tokenizer'](batch_df['input'], return_tensors='pt', padding='max_length',
                                                                       truncation=True, max_length=512).to('cuda' if torch.cuda.is_available() and args.use_cuda else 'cpu')

                        embeddings = models[model_lang]['model'](**input_tokens)['last_hidden_state'][:, 0, :]
                        prediction = models[model_lang]['classification_head'](embeddings).squeeze()

                        if (len(prediction.shape) == 0 and not args.pointwise_loss) or (len(prediction.shape) == 1 and args.pointwise_loss):
                            prediction = prediction.unsqueeze(0)
                        
                        if args.pointwise_loss:
                            batch_df['scores'] = [score[1].item() for score in prediction]
                        else:
                            batch_df['scores'] = [score[1] for score in prediction]

                        df_contexts.loc[batch_df.index, 'scores'] = batch_df['score']

                        scores_df = df_contexts['idx','scores'].groupby('idx').agg({'scores' : list}).reset_index()

                        df['scores'] = scores_df['scores']


                            
                            