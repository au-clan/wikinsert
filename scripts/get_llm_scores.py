"""
get_llm_scores.py

This script processes language context data for scoring using a specified language model.
It includes functionalities to:
- Parse command-line arguments for input and output directories, model parameters, and processing options.
- Load and prepare the language model, either multilingual or language-specific.
- Read input data from specified directories, handle mentions, and create context representations.
- Perform batched inference using the loaded model to generate scores for each context.
- Save the scored results in a specified output format (Parquet).

Usage:
    python get_llm_scores.py --data_dir <data_directory> --output_dir <output_directory> --lang <language> --side_contexts_size <size> --model_dir <model_directory> --model_prefix <model_prefix> --batch_size <batch_size> [options]

Options:
    --use_section_title     Use section titles in the input context.
    --use_mentions          Include mentions in the context input.
    --use_cuda              Utilize CUDA if available.
    --multilingual          Use a multilingual model instead of a language-specific one.
"""
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

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))


def fix_title(title: str) -> str:
    """
    Fixes a URL-encoded title by decoding it and replacing underscores with spaces.
    
    Args:
        title (str): The URL-encoded title string.
        
    Returns:
        str: The fixed title with underscores replaced by spaces.
    """
    return parse.unquote(title).replace('_', ' ')

def score_contexts(contexts_list: List[Dict[str, Any]], scores_list: List[float]) -> List[Dict[str, Any]]:
    """
    Assigns scores to a list of context dictionaries.
    
    Args:
        contexts_list (List[Dict[str, Any]]): A list of context dictionaries to score.
        scores_list (List[float]): A list of scores to assign to each context.
        
    Returns:
        List[Dict[str, Any]]: The updated list of context dictionaries with scores.
    """
    for context_dict, score in zip(contexts_list, scores_list):
        context_dict['score'] = score  # Add the score to each context dictionary
    
    return contexts_list


if __name__ == '__main__':
    # Initialize argument parser for command-line inputs
    parser = argparse.ArgumentParser()

    # Define command-line arguments with descriptions
    parser.add_argument('--data_dir', type=str, required=True, help='Path to data directory')
    parser.add_argument('--output_dir', type=str, required=True, help='Path to output directory')
    parser.add_argument('--lang', type=str, required=True, help='Languages to benchmark')
    parser.add_argument('--side_contexts_size', type=str, required=True, help='Size of side contexts to benchmark')
    parser.add_argument('--model_dir', type=str, required=True, help='Directory containing model directories')
    parser.add_argument('--model_prefix', type=str, required=True, help='Prefix of the model (suffix is language)')
    parser.add_argument('--use_section_title', action='store_true', help='Use section title in input')
    parser.add_argument('--batch_size', type=int, required=True, help='Batch size for processing')
    parser.add_argument('--use_mentions', action='store_true', help='Use mentions in input')
    parser.add_argument('--use_cuda', action='store_true', help='Use CUDA if available')
    parser.add_argument('--multilingual', action='store_true', help='Only use multilingual model')
    parser.add_argument('--multilingual_name', type=str, default='multilingual', help='Suffix of multilingual model')

    # Set default values for certain flags
    parser.set_defaults(use_section_title=False, use_mentions=False, use_cuda=False, multilingual=True)

    # Parse the command-line arguments
    args = parser.parse_args()

    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)

    # Check if data path exists
    if not os.path.exists(args.data_dir):
        raise ValueError('Data directory does not exist')

    # Check if model directory exists
    if not os.path.exists(args.model_dir):
        raise ValueError('Model directory does not exist')

    output_dimension = 1  # Set output dimension for model predictions
    batch_size = int(args.batch_size)  # Convert batch size to integer

    # Retrieve the language and size of side contexts
    lang = args.lang
    side_contexts_size = int(args.side_contexts_size)

    # Initialize model dictionary
    model = {}

    # Check if using a multilingual model
    if not args.multilingual:
        full_model_name = args.model_prefix + '_' + lang  # Construct model name

        # Verify model existence
        if not os.path.exists(os.path.join(args.model_dir, full_model_name)):
            raise ValueError(f'Model for {lang} does not exist')

        # Load model and tokenizer
        model['model'] = AutoModel.from_pretrained(os.path.join(args.model_dir, full_model_name, 'model'))
        model['model'].eval()  # Set model to evaluation mode
        model['classification_head'] = nn.Sequential(
            nn.Linear(model['model'].config.hidden_size, model['model'].config.hidden_size),
            nn.ReLU(),
            nn.Linear(model['model'].config.hidden_size, output_dimension)
        )
        model['classification_head'].load_state_dict(torch.load(
            os.path.join(args.model_dir, full_model_name, 'classification_head.pth'), map_location='cpu'))
        model['classification_head'].eval()  # Set classification head to evaluation mode
        model['tokenizer'] = AutoTokenizer.from_pretrained(os.path.join(args.model_dir, full_model_name, 'tokenizer'))
    else:
        # Handle multilingual model loading
        full_model_name = args.model_prefix + '_' + args.multilingual_name

        # Verify multilingual model existence
        if not os.path.exists(os.path.join(args.model_dir, full_model_name)):
            raise ValueError(f'Multilingual model {args.multilingual_name} does not exist')

        # Load multilingual model and tokenizer
        model['model'] = AutoModel.from_pretrained(os.path.join(args.model_dir, full_model_name, 'model'))
        model['model'].eval()
        model['classification_head'] = nn.Sequential(
            nn.Linear(model['model'].config.hidden_size, model['model'].config.hidden_size),
            nn.ReLU(),
            nn.Linear(model['model'].config.hidden_size, output_dimension)
        )
        model['classification_head'].load_state_dict(torch.load(
            os.path.join(args.model_dir, full_model_name, 'classification_head.pth'), map_location='cpu'))
        model['classification_head'].eval()
        model['tokenizer'] = AutoTokenizer.from_pretrained(os.path.join(args.model_dir, full_model_name, 'tokenizer'))

    # Check if the scoring output already exists
    if os.path.exists(os.path.join(args.output_dir, f'{lang}_{side_contexts_size}_{full_model_name}_scored.parquet')):
        raise ValueError(f'{lang} already done for context_size {side_contexts_size} and model {full_model_name}, passing')

    # Move model to GPU if specified and available
    if args.use_cuda:
        model['model'] = model['model'].to('cuda' if torch.cuda.is_available() else 'cpu')
        model['classification_head'] = model['classification_head'].to('cuda' if torch.cuda.is_available() else 'cpu')

    # Load mention map from parquet file
    mention_map_pre = pd.read_parquet(os.path.join(args.data_dir, f'mention_map_{lang}.parquet'))
    mention_map_pre = mention_map_pre.to_dict('records')
    
    # Create a mapping from titles to mentions
    mention_map = {}
    for row in mention_map_pre:
        title = fix_title(row['target_title'])  # Fix the title format
        if title in mention_map:
            mention_map[title].append(row['mention'])
        else:
            mention_map[title] = [row['mention']]

    # Process mentions to ensure uniqueness and limit to 10
    for title in mention_map:
        mention_map[title] = list(set([mention.lower() for mention in mention_map[title]]))
        if len(mention_map[title]) > 10:
            mention_map[title].sort(key=lambda x: len(x))
            while len(mention_map[title]) > 10 and len(mention_map[title][0]) < 3:
                mention_map[title].pop(0)
            mention_map[title] = mention_map[title][:10]
            random.shuffle(mention_map[title])
        mention_map[title] = ' '.join(mention_map[title])  # Join mentions into a single string

    print('Processing context size', side_contexts_size)

    # Check if the scoring output already exists
    if os.path.exists(os.path.join(args.output_dir, f'{lang}_{side_contexts_size}_scored.parquet')):
        raise ValueError(f'{lang}_{side_contexts_size}_scored.parquet already done, passing')

    # Load the data to be scored
    df = pd.read_parquet(os.path.join(args.data_dir, f'{lang}_{side_contexts_size}.parquet'))

    # Check if there's anything to score
    if df.shape[0] == 0:
        print(f"Nothing to score for {lang} and {side_contexts_size}")
        df.to_parquet(os.path.join(args.output_dir, f'{lang}_{side_contexts_size}_scored.parquet'))

    # Fix titles in the dataframe
    df['target_title'] = df['target_title'].apply(fix_title)

    # Prepare contexts for processing
    df['idx'] = df.index
    df['all_contexts'] = df['all_contexts']
    df_contexts = df.explode('all_contexts').reset_index()  # Explode contexts into separate rows
    df_contexts['contexts'] = df_contexts['all_contexts'].apply(lambda x: x['context'])
    df_contexts['sections'] = df_contexts['all_contexts'].apply(lambda x: x['section'])

    # Disable gradient calculation for inference
    with torch.no_grad():
        # Process the contexts in batches
        for i in tqdm(range(0, len(df_contexts), batch_size)):
            batch_df = df_contexts.iloc[i:i + batch_size]  # Get the current batch

            # Prepare input for the model
            if args.use_mentions:
                input0 = [
                    f"{target_title} {mention_map.get(target_title, '')}{model['tokenizer'].sep_token}{target_lead}"
                    for target_title, target_lead in zip(batch_df['target_title'], batch_df['target_lead'])
                ]
            else:
                input0 = [
                    f"{target_title}{model['tokenizer'].sep_token}{target_lead}"
                    for target_title, target_lead in zip(batch_df['target_title'], batch_df['target_lead'])
                ]

            if args.use_section_title:
                input1 = [f"{s}{model['tokenizer'].sep_token}{c}" for c, s in zip(batch_df['contexts'], batch_df['sections'])]
            else:
                input1 = batch_df['contexts']

            inputs = list(zip(input0, input1))  # Combine input pairs

            # Tokenize inputs and move to appropriate device
            input_tokens = model['tokenizer'](inputs, return_tensors='pt', padding='max_length',
                                               truncation=True, max_length=512).to('cuda' if torch.cuda.is_available() and args.use_cuda else 'cpu')

            # Get embeddings from the model
            embeddings = model['model'](**input_tokens)['last_hidden_state'][:, 0, :]
            prediction = model['classification_head'](embeddings).squeeze().detach().cpu().numpy()  # Get predictions
            
            # Store predictions in the dataframe
            df_contexts.loc[batch_df.index, 'scores'] = prediction

        # Aggregate scores for each context
        scores_df = df_contexts[['idx', 'scores']].groupby('idx').agg({'scores': list}).reset_index()

        # Assign scores back to the original dataframe
        df['scores'] = scores_df['scores']
        df['all_contexts'] = df.apply(lambda x: score_contexts(x['all_contexts'], x['scores']), axis=1)
        df.drop(columns=['scores'], inplace=True)  # Drop the scores column

        # Save the scored data to parquet
        df.to_parquet(os.path.join(args.output_dir, f'{lang}_{side_contexts_size}_{full_model_name}_scored.parquet'))




                        
                        