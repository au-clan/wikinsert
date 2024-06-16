from mwtokenizer.tokenizer import Tokenizer
import regex as re
import argparse
import os
from tqdm import tqdm
import pandas as pd

def preprocess(text):
    processed_text = re.sub(r'\.\[', '. [', text)
    return processed_text

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--full_texts_dir', type=str, required=True,
                        help='Path to the directory containing all the parsed HTML files, both links and sentences')
    parser.add_argument('--lang', type=str, required=True,
                        help='Language code')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')


    args = parser.parse_args()
    lang = args.lang

    if not os.path.exists(args.full_texts_dir):
        raise Exception(f'Full texts directory {args.full_texts_dir} does not exist')
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir, exist_ok=True)

    tokenizer = Tokenizer(language_code = lang)

    for filename in tqdm(os.listdir(args.full_texts_dir), desc='Sentence tokenization'):
        if filename.endswith("_text.jsonl"):
            with open(os.path.join(args.full_texts_dir, filename), 'r') as f:
                text = f.read()
            
            processed_text = preprocess(text)
            
            raw_sentences = list(tokenizer.sentence_tokenize(processed_text, use_abbreviation=True))
            
            out_filename = filename.replace('_text', '_raw_sentences')
            
            df = pd.DataFrame({'sentence': raw_sentences})
            df.to_json(os.path.join(args.output_dir, out_filename))

