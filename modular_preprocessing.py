from calendar import c
from numpy import argsort
import pandas as pd
import argparse
from bs4 import MarkupResemblesLocatorWarning
import re
import difflib
import math
from tqdm import tqdm
import os
import warnings
from multiprocessing import Pool, cpu_count
import json
tqdm.pandas()
import execjs


HTML_PROCESSORS = "js_parsing/html_processors.js"
PARSER = "parse" 

UNRELEVENT_SECTIONS = ["References", "Other Websites"]

with open(HTML_PROCESSORS, 'r') as f:
    html_processors = f.read()

html_processors_compiled = execjs.compile(html_processors)

warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

def get_sentences_and_links(file_path):
    results = html_processors_compiled.call(PARSER, file_path)
    sentences = json.loads(results['sentences'])
    links = json.loads(results['links'])
    sentences = pd.DataFrame(sentences)
    if sentences.shape[0] > 0:
        sentences = sentences.drop(columns = ['md5'])

    links = pd.DataFrame(links)

    return sentences, links

def fix_target_titles(title, redirect_map_1, redirect_map_2):
    counter = 0
    while title in redirect_map_1:
        title = redirect_map_1[title]
        counter += 1
        if counter == 10:
            break

    counter = 0
    while title in redirect_map_2:
        title = redirect_map_2[title]
        counter += 1
        if counter == 10:
            break
    return title

def clean_condition(txt):
    # don't allow sentences with less than 10 characters
    #don't allow list items to be splitted accros sentences: case dos no start with capital and does not end with point
    return len(txt) > 10 and (txt.strip()[0].isupper() or txt[-1] == '.')

def merge_sentences(row1, row2):
    row = {}
    row['text'] = row1['text'] + ' ' + row2['text'] 
    row['id'] = row1['id'] + row2['id'] #concat list of ids
    row['startIdx'] = row1['startIdx']
    row['endIdx'] = row2['endIdx']
    row['section'] = row1['section'] #section is the same
    row['locList'] = row1['locList'] + row2['locList'] #concat list of locations

    return row

def clean_sentences(sentences_df):
    # don't allow sentences with less than 10 characters
    #don't allow list items to be splitted accros sentences: case dos no start with capital and does not end with point
    new_sentences = []
    current_unclean = None 

    sentences_df['id'] = sentences_df['id'].apply(lambda x: [x])
    sentences_df['text'] = sentences_df['text'].apply(lambda x: x.strip())

    for _, row in sentences_df.iterrows():
        if row['section'] in UNRELEVENT_SECTIONS:
            continue

        row = row.to_dict()
        if current_unclean is None:
            if clean_condition(row['text']):
                new_sentences.append(row)
            else:
                current_unclean = row
        elif current_unclean['section'] == row['section']:
            current_unclean = merge_sentences(current_unclean, row)
            if clean_condition(current_unclean['text']):
                new_sentences.append(current_unclean)
                current_unclean = None
        else:
            if len(new_sentences) > 0:
                new_sentences[-1] = merge_sentences(new_sentences[-1], current_unclean)
            else:
                new_sentences.append(current_unclean)
            
            current_unclean = None

            if clean_condition(row['text']):
                new_sentences.append(row)
            else:
                current_unclean = row
    
    if current_unclean is not None:
        new_sentences.append(current_unclean)
        

    return pd.DataFrame(new_sentences).reset_index()

def fix_text(text):
    text = text.strip()
    text = re.sub(' +', ' ', text)
    text = re.sub('\n+', '\n', text)
    text = re.sub('\n +', '\n', text)
    return text

def create_all_contexts(section_sentences, side_contexts_size, correct_sentence):
    contexts = []
    context_texts = set([])
    for section in section_sentences:
        curr_sentences = section_sentences[section]
        for i, sentence in enumerate(section_sentences[section]):
            min_index = max(0, i - side_contexts_size)
            max_index = min(len(curr_sentences), i + side_contexts_size + 1)
            context = " ".join([s['clean_sentence']
                                for s in curr_sentences[min_index:max_index]]).strip()
            #if  context not in context_texts: #len(context.split(' ')) > 10 and
            contexts.append({'context': context, 'middle_sentence': sentence, 'section': section, 'correct' : correct_sentence})
            context_texts.add(context)
            #else:
            #    continue

    return contexts

def process_version(input):
    output = []
    d = difflib.Differ()
    file_1 = os.path.join(
        args.html_dir, f"{input['source_ID']}_{input['first_version']}.html")
    
    sentences_1, all_links_1 = get_sentences_and_links(file_1)
    if sentences_1.shape[0] == 0:
        print('No HTML found')
        print(f"{input['source_ID']}_{input['first_version']}.html")
        return []
    
    clean_sentences_1 = clean_sentences(sentences_1)
 
    for second_version in input['versions']:
        found_links = []
        file_2 = os.path.join(
            args.html_dir, f"{input['source_ID']}_{second_version}.html")
        
        sentences_2, all_links_2 = get_sentences_and_links(file_2)
        if sentences_2.shape[0] == 0:
            print('No HTML found')
            print(f"{input['source_ID']}_{second_version}.html")
            return []

        if all_links_2.shape[0] == 0:
            print('No links found')
            print(f"{input['source_ID']}_{second_version}.html")
            return []

        clean_sentences_2 = clean_sentences(sentences_2)

        original_lead = ''
        all_sentences = []
        diff = d.compare(list(clean_sentences_1['text']), list(clean_sentences_2['text']))
        index_in_1 = -1
        index_in_2 = -1

        for i, line in enumerate(diff):
            if line.startswith('?'):
                continue
            
            elif line.startswith('+'):
                index_in_2 += 1
                all_sentences.append({'status': 'added',
                                    'added_after': clean_sentences_1['id'][max(index_in_1, 0)],
                                    'index': len(all_sentences),
                                    'match': None,
                                    'section1': None,
                                    'section2' : clean_sentences_2['section'][index_in_2],
                                    'clean_sentence': line[2:].strip(),
                                    'ids1' : None,
                                    'ids2' : clean_sentences_2['id'][index_in_2],
                                    'startIdx1': None,
                                    'endIdx1': None,
                                    'startIdx2': clean_sentences_2['startIdx'][index_in_2],
                                    'endIdx2': clean_sentences_2['endIdx'][index_in_2],
                                    'locList1': None,
                                    'locList2': clean_sentences_2['locList'][index_in_2]})
                
                words = [word.strip() for word in all_sentences[-1]
                         ['clean_sentence'].replace('\n', ' ').split(' ') if word != '']
                freqs = {}
                for word in words:
                    freqs[word] = freqs.get(word, 0) + 1
                norm = math.sqrt(sum([freqs[word]**2 for word in freqs]))
                best_match = {'index': None, 'score': 0}
                for i, sentence in enumerate(all_sentences):
                    if sentence['status'] != 'removed' or sentence['match'] is not None:
                        continue
                    words = [word.strip() for word in sentence['clean_sentence'].replace(
                        '\n', ' ').split(' ') if word != '']
                    freqs_2 = {}
                    for word in words:
                        freqs_2[word] = freqs_2.get(word, 0) + 1
                    norm_2 = math.sqrt(
                        sum([freqs_2[word]**2 for word in freqs_2]))
                    score = 0
                    for word in freqs:
                        score += freqs[word] * freqs_2.get(word, 0)
                    score /= (norm * norm_2)
                    if score > best_match['score']:
                        best_match['index'] = i
                        best_match['score'] = score
                if best_match['score'] > 0.5:
                    all_sentences[best_match['index']
                                  ]['match'] = all_sentences[-1]['index']
                    all_sentences[-1]['match'] = all_sentences[best_match['index']]['index']
            elif line.startswith('-'):
                index_in_1 += 1
                all_sentences.append({'status': 'removed',
                                      'added_after': None, 
                                    'index': len(all_sentences),
                                    'match': None,
                                    'section1': clean_sentences_1['section'][index_in_1],
                                    'section2': None,
                                    'clean_sentence': line[2:].strip(),
                                    'ids1' : clean_sentences_1['id'][index_in_1],
                                    'ids2' : None,
                                    'startIdx1': clean_sentences_1['startIdx'][index_in_1],
                                    'endIdx1': clean_sentences_1['endIdx'][index_in_1],
                                    'startIdx2': None,
                                    'endIdx2': None,
                                    'locList1': clean_sentences_1['locList'][index_in_1],
                                    'locList2': None})

                words = [word.strip() for word in all_sentences[-1]
                         ['clean_sentence'].replace('\n', ' ').split(' ') if word != '']
                freqs = {}
                for word in words:
                    freqs[word] = freqs.get(word, 0) + 1
                norm = math.sqrt(sum([freqs[word]**2 for word in freqs]))
                best_match = {'index': None, 'score': 0}
                for i, sentence in enumerate(all_sentences):
                    if sentence['status'] != 'added' or sentence['match'] is not None:
                        continue
                    words = [word.strip() for word in sentence['clean_sentence'].replace(
                        '\n', ' ').split(' ') if word != '']
                    freqs_2 = {}
                    for word in words:
                        freqs_2[word] = freqs_2.get(word, 0) + 1
                    norm_2 = math.sqrt(
                        sum([freqs_2[word]**2 for word in freqs_2]))
                    score = 0
                    for word in freqs:
                        score += freqs[word] * freqs_2.get(word, 0)
                    score /= (norm * norm_2)
                    if score > best_match['score']:
                        best_match['index'] = i
                        best_match['score'] = score
                if best_match['score'] > 0.5:
                    all_sentences[best_match['index']
                                  ]['match'] = all_sentences[-1]['index']
                    all_sentences[-1]['match'] = all_sentences[best_match['index']]['index']

                if clean_sentences_1['section'][index_in_1] == 'Lead':
                    original_lead += ' ' + all_sentences[-1]['clean_sentence']
            else:
                index_in_1 += 1
                index_in_2 += 1

                if clean_sentences_1['section'][index_in_1] == 'Lead':
                    original_lead += ' ' + line.strip()

                all_sentences.append({'status': 'neutral',
                                    'added_after': None,
                                    'index': len(all_sentences),
                                    'match': None,
                                    'section1' : clean_sentences_1['section'][index_in_1],
                                    'section2' : clean_sentences_2['section'][index_in_2],
                                    'clean_sentence': line.strip(),
                                    'ids1' : clean_sentences_1['id'][index_in_1],
                                    'ids2' : clean_sentences_2['id'][index_in_2],
                                    'startIdx1': clean_sentences_1['startIdx'][index_in_1],
                                    'endIdx1': clean_sentences_1['endIdx'][index_in_1],
                                    'startIdx2': clean_sentences_2['startIdx'][index_in_2],
                                    'endIdx2': clean_sentences_2['endIdx'][index_in_2],
                                    'locList1': clean_sentences_1['locList'][index_in_1],
                                    'locList2': clean_sentences_2['locList'][index_in_2]})

        section_sentences = {}
        for sentence in all_sentences:
            if sentence['status'] == 'added':
                continue
            if sentence['section1'] not in section_sentences:
                section_sentences[sentence['section1']] = []
            section_sentences[sentence['section1']].append(sentence)

        if all_links_1.shape[0] == 0:
            all_links_1 = pd.DataFrame(columns=all_links_2.columns)
         
        all_links = all_links_1.merge(all_links_2, on=['link'], how='outer', suffixes=('_1', '_2'))
        added_links = all_links[all_links['sentid_1'].isnull()]

        all_sentences2 = list(filter(lambda x: x['status'] != 'removed', all_sentences))

        for _, link in added_links.iterrows():
            
            if link['section_2'] in UNRELEVENT_SECTIONS:
                continue
            
            sentences = list(filter(lambda x: int(link['sentid_2']) in x['ids2'], all_sentences2))

            if len(sentences) == 0:
                print("Sentences2:")
                for sentence in all_sentences:
                    print(sentence['clean_sentence'])
                    print(sentence['ids2'])
                    print('=========')
                
                for _, sentence in sentences_2.iterrows():
                    print(sentence['text'])
                    print(sentence['id'])
                    print('=========')

                print(f"No sentence found for link {link}")
                raise Exception('No sentence found for link')
                continue

            sentence = list(sentences)[0]

            if sentence['match'] is None:
                direct_match = False
                section = sentence['section1']
                new_section = sentence['section2']
                # go through the previous context_size and next context_size sentences
                # if any of these is neutral and has the same section, use it as context
                # if any of these is added and has a match and has the same section, use it as context
                left_index = sentence['index'] - 1
                left_context = []
                counter = 0
                continuous_left_added_text = []
                accept = True
                while left_index >= 0 and counter < (2*args.side_contexts_size) and len(left_context) < args.side_contexts_size:
                    counter += 1
                    if all_sentences[left_index]['section1'] != sentence['section1']:
                        break
                    if all_sentences[left_index]['status'] == 'neutral':
                        left_context.append(
                            all_sentences[left_index]['clean_sentence'])
                        accept = False
                    elif all_sentences[left_index]['status'] == 'added' and accept and all_sentences[left_index]['match'] is None:
                        continuous_left_added_text.append(
                            all_sentences[left_index]['clean_sentence'])
                    elif all_sentences[left_index]['status'] == 'removed':
                        accept = False
                        if all_sentences[left_index]['match'] is not None and all_sentences[left_index]['match'] < sentence['index'] + 2*args.side_contexts_size +1:
                            left_context.append(
                                all_sentences[left_index]['clean_sentence'])
                    left_index -= 1
                right_index = sentence['index'] + 2*args.side_contexts_size +1
                right_context = []
                # rightmost_index = sentence['index'] + 1
                continuous_right_added_text = []
                while right_index > sentence['index']:
                    if right_index >= len(all_sentences) or all_sentences[right_index]['section1'] != sentence['section1']:
                        right_index -= 1
                        continue
                    if all_sentences[right_index]['status'] == 'neutral':
                        right_context.append(
                            all_sentences[right_index]['clean_sentence'])
                        continuous_right_added_text = []
                        # rightmost_index = max(rightmost_index, right_index)
                    elif all_sentences[right_index]['status'] == 'added' and all_sentences[right_index]['match'] is None:
                        continuous_right_added_text.append(
                            all_sentences[right_index]['clean_sentence'])
                    elif all_sentences[right_index]['status'] == 'removed':
                        continuous_right_added_text = []
                        if all_sentences[right_index]['index'] is not None and all_sentences[right_index]['index'] > sentence['index'] - (2*args.side_contexts_size +1):
                            right_context.append(
                                all_sentences[right_index]['clean_sentence'])
                            # rightmost_index = max(rightmost_index, right_index)
                    right_index -= 1
                right_context = right_context[-args.side_contexts_size:]
                # right_index = rightmost_index
                context = ' '.join(
                    left_context[::-1]) + ' '.join(right_context[::-1])
                # added_text = ' '.join(
                #     continuous_left_added_text[::-1]) + sentence['clean_sentence'] + ' '.join(continuous_right_added_text[::-1])
            else:
                direct_match = True
                left_context = []
                left_index = sentence['match'] - 1
                while left_index >= 0 and len(left_context) < args.side_contexts_size:
                    if all_sentences[left_index]['status'] == 'added':
                        left_index -= 1
                        continue
                    if all_sentences[left_index]['section1'] != all_sentences[sentence['match']]['section1']:
                        break
                    left_context.append(
                        all_sentences[left_index]['clean_sentence'])
                    left_index -= 1
                right_context = []
                right_index = sentence['match'] + 1
                while right_index < len(all_sentences) and len(right_context) < args.side_contexts_size:
                    if all_sentences[right_index]['status'] == 'added':
                        right_index += 1
                        continue
                    if all_sentences[right_index]['section1'] != all_sentences[sentence['match']]['section1']:
                        break
                    right_context.append(
                        all_sentences[right_index]['clean_sentence'])
                    right_index += 1
                context = ' '.join(left_context[::-1]) + ' ' + all_sentences[sentence['match']
                                                                             ]['clean_sentence'] + ' ' + ' '.join(right_context)
                section = all_sentences[sentence['match']]['section1']
                new_section = sentence['section2']

                if sentence['match'] is None:
                    present = False
                    if new_section not in section_sentences:
                        missing_category = 'missing_section'
                    else:
                        if continuous_left_added_text == [] and continuous_right_added_text == []:
                            if sentence['status'] == 'neutral':
                                missing_category = 'missing_mention'
                            else:
                                missing_category = 'missing_sentence'
                        else:
                            missing_category = 'missing_span'

                else:
                    present = (link['text_2'].lower() in all_sentences[sentence['match']]['clean_sentence'].lower())
                    if present:
                        missing_category = 'missing_mention'
                    else: 
                        missing_category = None

                # get target title
                target_title = fix_target_titles(
                    link['link'][6:].split('#')[0], redirect_1, redirect_2)
                all_contexts = create_all_contexts(
                    section_sentences, args.side_contexts_size, sentence)
                if target_title in input['versions'][second_version]:
                    if missing_category == 'missing_mention':
                        if sentence['status'] == 'neutral' :
                            insert_index = sentence['ids1']
                        else:
                            insert_index = all_sentences[sentence['match']]['ids1']
                    else:
                        insert_index = sentence['added_after']
                    output.append({
                        'source_title': input['source_title'],
                        'source_ID': input['source_ID'],
                        'target_title': target_title,
                        'context': context,
                        'insert_indices': insert_index,
                        'section': section,
                        'mention_present': present,
                        'source_lead': original_lead.strip(),
                        'first_version': input['first_version'],
                        'second_version': second_version,
                        'direct_match': direct_match,
                        'missing_category': missing_category,
                        'all_contexts': str(all_contexts)
                    })
                    found_links.append(output[-1])
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--versions_file', type=str,
                        required=True, help='Path to the versions file')
    parser.add_argument('--html_dir', type=str, required=True,
                        help='Path to the directory containing all the HTML files')
    parser.add_argument('--redirect_1', type=str, required=True,
                        help='Path to the first redirect file')
    parser.add_argument('--redirect_2', type=str, required=True,
                        help='Path to the second redirect file')
    parser.add_argument('--mention_map', type=str, required=True,
                        help='Path to the mention map file')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Path to the output directory')
    parser.add_argument('--side_contexts_size', type=int, required=True,
                        help='Half size of the context')
    parser.add_argument('--n_processes', type=int, default=1,
                        help='Number of processes to use')

    args = parser.parse_args()

    # check if input files exist
    if not os.path.exists(args.versions_file):
        raise Exception('Versions file does not exist')
    if not os.path.exists(args.html_dir):
        raise Exception('HTML directory does not exist')
    if not os.path.exists(args.redirect_1):
        raise Exception('Redirect file 1 does not exist')
    if not os.path.exists(args.redirect_2):
        raise Exception('Redirect file 2 does not exist')
    if not os.path.exists(args.mention_map):
        raise Exception('Mention map file does not exist')

    # create the output directory if it does not exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    # load the data
    df_versions = pd.read_parquet(args.versions_file)
    redirect_1 = pd.read_parquet(args.redirect_1)
    redirect_2 = pd.read_parquet(args.redirect_2)

    redirect_1 = redirect_1.to_dict()['redirect']
    redirect_2 = redirect_2.to_dict()['redirect']

    print('Fixing target titles')
    df_versions['target_title'] = df_versions['target_title'].progress_apply(
        lambda x: fix_target_titles(x, redirect_1, redirect_2))

    print('Creating revisions dictionary')
    df_versions = df_versions.to_dict('records')
    expected_links = len(df_versions)
    print(f'Expected links: {expected_links}')
    revisions = {}
    for row in tqdm(df_versions):
        if row['first_version'] not in revisions:
            revisions[row['first_version']] = {
                'source_title': row['source_title'],
                'source_ID': row['source_ID'],
                'versions': {
                    row['second_version']: [row['target_title']]
                }
            }
        else:
            if row['second_version'] not in revisions[row['first_version']]['versions']:
                revisions[row['first_version']]['versions'][row['second_version']] = [
                    row['target_title']]
            else:
                revisions[row['first_version']]['versions'][row['second_version']].append(
                    row['target_title'])
    revisions_clean = []
    for revision in revisions:
        revisions_clean.append({
            'first_version': revision,
            'source_title': revisions[revision]['source_title'],
            'source_ID': revisions[revision]['source_ID'],
            'versions': revisions[revision]['versions']
        })

    def initializer():
        global redirect_1
        global redirect_2
        global mentions_map

        redirect_1 = pd.read_parquet(args.redirect_1)
        redirect_2 = pd.read_parquet(args.redirect_2)
        redirect_1 = redirect_1.to_dict()['redirect']
        redirect_2 = redirect_2.to_dict()['redirect']

        mentions_map_pre = pd.read_parquet(args.mention_map)
        mentions_map_pre = mentions_map_pre.to_dict(orient='records')
        mentions_map = {}
        for row in mentions_map_pre:
            target_title = fix_target_titles(
                row['target_title'], redirect_1, redirect_2)
            if target_title not in mentions_map:
                mentions_map[target_title] = [row['mention']]
            else:
                mentions_map[target_title].append(row['mention'])
    
    revisions_clean = sorted(revisions_clean, key=lambda x: len(x['versions']), reverse=True)
    output = []
    nb_processes_ = min(cpu_count(), args.n_processes)
    print(f"Running on {nb_processes_} processes")
    pool = Pool(nb_processes_, initializer=initializer)
    print("Parallel multiprocess")
    for result in tqdm(pool.imap(process_version, revisions_clean), total=len(revisions_clean)):
        output.extend(result)
    pool.close()
    pool.join()

    

    '''for i in range(0, len(output), 100_000):
        df_output = pd.DataFrame(output[i:i+100_000])
        df_output['context'] = df_output['context'].progress_apply(fix_text)
        df_output['source_lead'] = df_output['source_lead'].progress_apply(
            fix_text)
        df_output.to_parquet(os.path.join(args.output_dir, f'test_data_{i}.parquet'))'''
    
    print(f"The length of the output is {len(output)}")

    df_output = pd.DataFrame(output)
    df_output['context'] = df_output['context'].progress_apply(fix_text)
    df_output['source_lead'] = df_output['source_lead'].progress_apply(
        fix_text)
    df_output.to_parquet(os.path.join(args.output_dir, f'test_data.parquet'))

