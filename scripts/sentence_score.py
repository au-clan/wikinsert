import logging
import os
import random
from typing import Dict, Any, List

import pandas as pd
import torch
import torch.nn as nn
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer

# Import utility functions from the common module

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)


def get_context_for_sentence(sentences, sentence, context_size=5):
    sentence_ids = [sentence['idx'] for sentence in sentences]
    current_sentence_pos = sentence['idx']

    start_pos = max(0, current_sentence_pos - context_size)
    end_pos = min(len(sentence_ids) - 1, current_sentence_pos + context_size)

    context_indices = sentence_ids[start_pos:end_pos + 1]

    # Get the context sentences
    context_sentences = [sentence for sentence in sentences if sentence['idx'] in context_indices]
    # Join the context sentences into a single string
    context_text = " ".join([sentence['sentence'] for sentence in context_sentences])
    return context_text


def set_context_for_sentences(section, context_size=5):
    sentences = section['sentences']
    for sentence in sentences:
        context = get_context_for_sentence(sentences, sentence, context_size)
        sentence['context'] = context


def load_mention_map(mention_map_path):
    try:
        mention_df = pd.read_parquet(mention_map_path)
        mention_map = {}
        for _, row in mention_df.iterrows():
            title = row.get('target_title')
            mention_map.setdefault(title, []).append(row.get('mention', '').lower())
        for title, mentions in mention_map.items():
            mentions = list(set(mentions))
            if len(mentions) > 10:
                mentions.sort(key=len)
                while len(mentions) > 10 and len(mentions[0]) < 3:
                    mentions.pop(0)
                mentions = mentions[:10]
                random.shuffle(mentions)
            mention_map[title] = ' '.join(mentions)
    except Exception:
        mention_map = {}
    return mention_map


def load_model(model_dir, use_cuda=True):
    logging.info(f"Loading model from {model_dir}")

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
        model['classification_head'] = model['classification_head'].to(
            'cuda' if torch.cuda.is_available() else 'cpu')
    return model

class SentenceScorer:
    def __init__(self, model_path, mention_map_path):
        logging.info(f"Loading mention map from {mention_map_path}")
        self.mention_map = load_mention_map(mention_map_path)
        logging.info(f"Loading model from {model_path}")
        self.model = load_model(model_path)

    def get_sentence_scores(
            self,
            sections: List[Dict[str, Any]],
            article_title: str,
            target_title: str,
            target_lead: str,
            context_size: int = 5,
            batch_size: int = 8
    ):
        logging.info(f"Scoring {article_title} with context size {context_size}")

        for section in sections:
            set_context_for_sentences(section, context_size)
        # make all the sentences into a single data fram withouth section separator
        sentences = []
        for section in sections:
            section_title = section.get('title', '')
            for sentence in section['sentences']:
                sentence['section'] = section_title
                sentences.append(sentence)

        scored_df = pd.DataFrame(sentences)
        scored_df['score'] = 0.0
        sep = self.model['tokenizer'].sep_token


        # Score sentences in batches
        with torch.no_grad():
            for i in tqdm(range(0, len(scored_df), batch_size)):
                batch_df = scored_df.iloc[i:i + batch_size]
                logging.info(f"Batch copied, now getting context for sentences")

                # Prepend mentions into the target context if available
                mention_str = self.mention_map.get(target_title, "")
                prefix = (
                    f"{target_title} {mention_str}{sep}{target_lead}"
                    if mention_str else
                    f"{target_title}{sep}{target_lead}"
                )

                input0 = [prefix] * len(batch_df)
                input1 = [f"{row['section']}{sep}{row['context']}" for _, row in batch_df.iterrows()]

                input_tokens = self.model['tokenizer'](
                    list(zip(input0, input1)),
                    return_tensors='pt', padding='max_length',
                    truncation=True, max_length=512
                ).to('cpu')

                embeddings = self.model['model'](**input_tokens)['last_hidden_state'][:, 0, :]
                prediction = self.model['classification_head'](embeddings).squeeze().detach().cpu().numpy()

                # Handle case where prediction is a single value
                if len(batch_df) == 1:
                    prediction = [float(prediction)]
                # Store predictions in the DataFrame
                scored_df.iloc[i:i + batch_size, scored_df.columns.get_loc('score')] = prediction
        # drop the sentences and the context
        logging.info("Final scored rows with context and sentence columns retained:")
        for idx, row in scored_df.iterrows():
            logging.info(row.to_dict())
        scored_df = scored_df.drop(columns=['context'])
        scored_df = scored_df.drop(columns=['sentence'])
        return scored_df
