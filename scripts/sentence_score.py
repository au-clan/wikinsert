#!/usr/bin/env python3
"""
Sentence Scorer for Wikipedia Articles

This script scores sentences from source and target Wikipedia articles based on their relevance.
It can either use pre-extracted sentences from JSON files or fetch and extract sentences directly.

Each sentence is scored based on its context (sentences before and after in the same section),
the target article title, and the target article lead section.

Usage:
    python sentence_score.py --source_url <source_url> --target_url <target_url> [options]

Options:
    --source_url SOURCE_URL     URL of the source Wikipedia article (required)
    --target_url TARGET_URL     URL of the target Wikipedia article (required)
    --source_json SOURCE_JSON   Path to the source JSON file (optional)
    --target_json TARGET_JSON   Path to the target JSON file (optional)
    --model_dir MODEL_DIR       Directory containing the model (required)
    --output OUTPUT             Path to the output JSON file (optional)
    --context_size CONTEXT_SIZE Number of sentences before and after to include in context (default: 5)

Examples:
    # Score sentences using URLs only (will extract sentences from URLs)
    python sentence_score.py --source_url https://en.wikipedia.org/wiki/Python_(programming_language) --target_url https://en.wikipedia.org/wiki/Programming_language --model_dir ./models/sentence_scorer

    # Score sentences using existing JSON files
    python sentence_score.py --source_url https://en.wikipedia.org/wiki/Python_(programming_language) --target_url https://en.wikipedia.org/wiki/Programming_language --source_json Python_sentences.json --target_json Programming_language_sentences.json --model_dir ./models/sentence_scorer

    # Score sentences with custom context size and output file
    python sentence_score.py --source_url https://en.wikipedia.org/wiki/Python_(programming_language) --target_url https://en.wikipedia.org/wiki/Programming_language --context_size 3 --output python_scored.json --model_dir ./models/sentence_scorer
"""

import argparse
import json
import logging
import os
import random
import sys
from typing import Dict, Any, Optional

import pandas as pd
import torch
import torch.nn as nn
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer

# Import utility functions from the common module
from wiki_sentence_utils import parse_article, extract_lead_section

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)


def load_article_from_json(json_path: str):
    logging.info(f"Loading sentences from {json_path}")
    try:
        article = json.load(open(json_path))
        logging.info(f"Loaded {len(article['sections'])} sections")
        return article
    except Exception as e:
        logging.error(f"Error loading sentences from {json_path}: {e}")
        return None


def get_article(article_url: str, json_path: Optional[str] = None):
    if json_path and os.path.exists(json_path):
        article = load_article_from_json(json_path)
        if article is not None:
            return article

    logging.info(f"Extracting sentences from {article_url}")
    article = parse_article(article_url)

    if json_path:
        article = json.dump(article, open(json_path, 'w'), indent=2)
        logging.info(f"Saved sentences to {json_path}")

    return article


def get_context_for_sentence(sentences, sentence, context_size=5):
    sentence_ids = [sentence['sen-id'] for sentence in sentences]
    current_sentence_pos = sentence['sen-id']
    logging.info(f"type of sentences {type(sentences)} and the length of {len(sentences)}")

    start_pos = max(0, current_sentence_pos - context_size)
    logging.info(f"type of start pos {type(start_pos)} and the value of {start_pos}")
    end_pos = min(len(sentence_ids) - 1, current_sentence_pos + context_size)
    logging.info(f"type of end pos {type(end_pos)} and the value of {end_pos}")

    context_indices = sentence_ids[start_pos:end_pos + 1]
    logging.info(f"type of context indices {type(context_indices)} and the value of {context_indices}")

    # Get the context sentences
    context_sentences = [sentence for sentence in sentences if sentence['sen-id'] in context_indices]
    logging.info(f"type of context sentences {type(context_sentences)} and the length of {len(context_sentences)}")
    # Join the context sentences into a single string
    context_text = " ".join([sentence['sentence'] for sentence in context_sentences])
    logging.info(f"context_text {context_text}")
    return context_text


def load_model(model_dir, use_cuda=True):
    """
    Load the language model for scoring.

    Args:
        model_dir: Directory containing the model
        use_cuda: Whether to use CUDA for GPU acceleration

    Returns:
        A dictionary containing the model, tokenizer, and classification head
    """
    logging.info(f"Loading model from {model_dir}")

    # If model_dir is not provided, use a default model
    if not model_dir:
        logging.info("Using default model")
        model = {
            'model': AutoModel.from_pretrained('bert-base-multilingual-cased'),
            'tokenizer': AutoTokenizer.from_pretrained('bert-base-multilingual-cased')
        }
        model['model'].eval()
        model['classification_head'] = nn.Sequential(
            nn.Linear(model['model'].config.hidden_size, model['model'].config.hidden_size),
            nn.ReLU(),
            nn.Linear(model['model'].config.hidden_size, 1)
        )
        model['classification_head'].eval()
    else:
        # Load the model from the specified directory
        model = {
            'model': AutoModel.from_pretrained(os.path.join(model_dir, 'model')),
            'tokenizer': AutoTokenizer.from_pretrained(os.path.join(model_dir, 'tokenizer'))
        }
        model['model'].eval()
        model['classification_head'] = nn.Sequential(
            nn.Linear(model['model'].config.hidden_size, model['model'].config.hidden_size),
            nn.ReLU(),
            nn.Linear(model['model'].config.hidden_size, 1)
        )
        model['classification_head'].load_state_dict(torch.load(
            os.path.join(model_dir, 'classification_head.pth'), map_location='cpu'))
        model['classification_head'].eval()

    if use_cuda:
        model['model'] = model['model'].to('cuda' if torch.cuda.is_available() else 'cpu')
        model['classification_head'] = model['classification_head'].to('cuda' if torch.cuda.is_available() else 'cpu')
    return model


def set_context_for_sentences(section, context_size=5):
    sentences = section['sentences']
    logging.info(f"type of the sentences {type(sentences)} and the length of {len(sentences)}")
    for sentence in sentences:
        logging.info(f"Sentence start contexting")
        context = get_context_for_sentence(sentences, sentence, context_size)
        sentence['context'] = context


def get_sentence_scores_with_context(
        article: Dict[str, Any],
        target_title: str,
        target_lead: str,
        model_dir: str,
        context_size: int = 5,
        batch_size: int = 8
):
    logging.info(f"Scoring {article['title']} with context size {context_size}")
    model = {}
    if model_dir:
        model = load_model(model_dir)

    sections = article['sections']

    for section in sections:
        set_context_for_sentences(section, context_size)
    # make all the sentences into a single data fram withouth section separator
    sentences = []
    for section in sections:
        for sentence in section['sentences']:
            # drop the sen-id
            sentence.pop('sen-id', None)
            sentences.append(sentence)

    # Create a DataFrame from the sentences
    scored_df = pd.DataFrame(sentences)
    scored_df['score'] = 0.0

    # Score sentences in batches
    with torch.no_grad():
        for i in tqdm(range(0, len(scored_df), batch_size)):
            batch_df = scored_df.iloc[i:i + batch_size]
            if model_dir:
                logging.info(f"Batch copied, now getting context for sentences")

                # Prepare input for the model
                input0 = [
                    f"{target_title}{model['tokenizer'].sep_token}{target_lead}"
                    for _ in range(len(batch_df))
                ]

                input1 = batch_df['context'].tolist()

                inputs = list(zip(input0, input1))  # Combine input pairs

                # Tokenize inputs and move to appropriate device
                input_tokens = model['tokenizer'](inputs, return_tensors='pt', padding='max_length',
                                                  truncation=True, max_length=512).to('cpu')

                # Get embeddings from the model
                embeddings = model['model'](**input_tokens)['last_hidden_state'][:, 0, :]
                prediction = model['classification_head'](embeddings).squeeze().detach().cpu().numpy()

                # Handle case where prediction is a single value
                if len(batch_df) == 1:
                    prediction = [float(prediction)]
                # Store predictions in the DataFrame
                scored_df.iloc[i:i + batch_size, scored_df.columns.get_loc('score')] = prediction
            else:
                # If no model is provided, assign random scores
                logging.info("No model provided, assigning random scores")
                scored_df.iloc[i:i + batch_size, scored_df.columns.get_loc('score')] = [max(0.5, random.random()) for _
                                                                                        in range(len(batch_df))]

    return scored_df


def get_target_info(target_url: str, target_json_path: Optional[str] = None) -> tuple:
    """
    Get target article information (title and lead section).

    Args:
        target_url: URL of the target Wikipedia article
        target_json_path: Path to the target JSON file (optional)

    Returns:
        A tuple containing (title, lead_text)
    """
    # Extract title and lead section
    target_title, target_lead = extract_lead_section(target_url)

    # If target JSON path is provided, also get sentences
    if target_json_path:
        get_article(target_url, target_json_path)

    return target_title, target_lead


def main():
    parser = argparse.ArgumentParser(
        description="Score sentences from a source Wikipedia article based on their relevance to a target article")
    parser.add_argument("--source_url", type=str, required=True, help="URL of the source Wikipedia article")
    parser.add_argument("--target_url", type=str, required=True, help="URL of the target Wikipedia article")
    parser.add_argument("--source_json", type=str, help="Path to the source JSON file (optional)")
    parser.add_argument("--target_json", type=str, help="Path to the target JSON file (optional)")
    # TODO change it to required later
    parser.add_argument("--model_dir", type=str, required=False, help="Directory containing the model")
    parser.add_argument("--output", type=str, help="Path to the output JSON file")
    parser.add_argument("--context_size", type=int, default=5,
                        help="Number of sentences before and after to include in context")

    args = parser.parse_args()

    try:
        article = get_article(args.source_url, args.source_json)

        target_title, target_lead = get_target_info(args.target_url, args.target_json)
        # Score sentences
        scored_sentences = get_sentence_scores_with_context(
            article,
            target_title,
            target_lead,
            args.model_dir,
            context_size=args.context_size
        )
        logging.info(f"Scored {len(scored_sentences)} sentences")

        # Determine output file path
        if args.output:
            output_path = args.output
        else:
            source_title = args.source_url.split('/')[-1]
            target_title_slug = args.target_url.split('/')[-1]
            output_path = f"{source_title}_{target_title_slug}_scored.json"

        # Save the scored sentences to a JSON file
        scored_sentences.to_json(output_path, orient='records', indent=2)
        logging.info(f"Saved scored sentences to {output_path}")

        logging.info("Script execution completed successfully")
    except Exception as e:
        logging.error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
