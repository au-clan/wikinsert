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
import time


HTML_PROCESSORS = "js_parsing/html_processors.js"
PARSER = "parse" 

UNRELEVENT_SECTIONS = ["References", "Other Websites"]

with open(HTML_PROCESSORS, 'r') as f:
    html_processors = f.read()

html_processors_compiled = execjs.compile(html_processors)

warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

def get_sentences_and_links(file_path):
    start = time.time()
    results = html_processors_compiled.call(PARSER, file_path)
    time_after_parsing = time.time()
    #print(f"Time for parsing: {time_after_parsing - start}")
    sentences = json.loads(results['sentences'])
    links = json.loads(results['links'])
    sentences = pd.DataFrame(sentences)
    if sentences.shape[0] > 0:
        sentences = sentences.drop(columns = ['md5'])

    links = pd.DataFrame(links)
    time_after_processing = time.time()
    #print(f"Time for processing: {time_after_processing - time_after_parsing}")
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
    return len(txt) > 10 and (txt.strip()[0].isupper() or txt.strip()[-1] == '.')

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
    new_sentences = []
    current_unclean = None 

    sentences_df['id'] = sentences_df['id'].apply(lambda x: [x])
    sentences_df['text'] = sentences_df['text'].apply(lambda x: x.strip())

    for _, row in sentences_df.iterrows():
        if row['section'] in UNRELEVENT_SECTIONS:
            continue
        if row['text'] == '':
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
                if new_sentences[-1]['section'] == row['section']:
                    new_sentences[-1] = merge_sentences(new_sentences[-1], current_unclean)
                else:
                    new_sentences.append(current_unclean)
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

def create_all_contexts(section_sentences, side_contexts_size):
    contexts = []
    for section in section_sentences:
        curr_sentences = section_sentences[section]
        for i, sentence in enumerate(section_sentences[section]):
            min_index = max(0, i - side_contexts_size)
            max_index = min(len(curr_sentences), i + side_contexts_size + 1)
            context = " ".join([s['clean_sentence']
                                for s in curr_sentences[min_index:max_index]]).strip()
            #if  context not in context_texts: #len(context.split(' ')) > 10 and
            contexts.append({'context': context, 'middle_sentence': sentence, 'section': section})
            #else:
            #    continue

    return contexts

def get_group_indexes(diff):
    spe_indexes = [i for i, line in enumerate(diff) if line.startswith('?')]
    all_starts = [line[0] for line in diff]

    group_indexes = []
    last_added = -1
    for idx in spe_indexes:
        if idx == 0:
            raise Exception('Index 0')
        if all_starts[idx-1] == ' ':
            raise Exception('Space before ?')
        if all_starts[idx-1] == '+':
            if idx == 1:
                raise Exception('? Index 1 after +')
            if all_starts[idx-2] == ' ':
                raise Exception('Space before +?')
            if all_starts[idx-2] == '+':
                raise Exception('++?')
            if all_starts[idx-2] == '-':
                group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-2))
                group_indexes.append({idx-2 : '-', idx-1 : '+', idx : '?'})
                last_added = idx
                continue
            if all_starts[idx-2] == '?':
                if idx == 2:
                    raise Exception('? Index -2 after +') 
                if all_starts[idx-3] == ' ' or all_starts[idx-3] == '+':
                    raise Exception(' " "or+ ?+? ')
                continue
        if all_starts[idx-1] == '-':
            if idx == len(diff) - 1:
                raise Exception('-? att the end')
            if all_starts[idx+1] == ' ':
                raise Exception('Space after -?')
            if all_starts[idx+1] == '-':
                raise Exception('- -?')
            
            if all_starts[idx+1] == '+':
                if idx == len(diff) - 2:
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx : '?', idx+1 : '+'})
                    last_added = idx+1
                    continue
                
                if all_starts[idx+2] == '?':
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx : '?', idx+1 : '+', idx+2 : '?'})
                    last_added = idx+2
                    continue
                else:
                    group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, idx-1))
                    group_indexes.append({idx-1: '-', idx : '?', idx+1 : '+'})
                    last_added = idx+1
                    continue
    
    if last_added != len(diff) - 1:
        group_indexes.extend({j: all_starts[j]} for j in range(last_added+1, len(diff)))

    return group_indexes
    
def process_version(input):
    
    output = []
    d = difflib.Differ()
    file_1 = os.path.join(
        args.html_dir, f"{input['source_ID']}_{input['first_version']}.html")
    start_time = time.time()
    sentences_1, all_links_1 = get_sentences_and_links(file_1)
    time_after_parsing_1 = time.time()
    if sentences_1.shape[0] == 0:
        print('No HTML found')
        print(f"{input['source_ID']}_{input['first_version']}.html")
        return []
    
    clean_sentences_1 = clean_sentences(sentences_1)
    
    time_after_cleaning_1 = time.time()

    times_after_parsing_2 = []
    times_afer_cleaning_2 = []
    times_after_diff = []
    times_afer_all_sentences = []
    times_after_merging_links = []
    times_after_processing_links = []

    for second_version in input['versions']:
        found_links = []
        file_2 = os.path.join(
            args.html_dir, f"{input['source_ID']}_{second_version}.html")
        
        sentences_2, all_links_2 = get_sentences_and_links(file_2)

        times_after_parsing_2.append(time.time())

        if sentences_2.shape[0] == 0:
            print('No HTML found')
            print(f"{input['source_ID']}_{second_version}.html")
            return []

        if all_links_2.shape[0] == 0:
            print('No links found')
            print(f"{input['source_ID']}_{second_version}.html")
            return []

        clean_sentences_2 = clean_sentences(sentences_2)

        times_afer_cleaning_2.append(time.time())

        original_lead = ''
        all_sentences = []
        diff = list(d.compare(list(clean_sentences_1['text']), list(clean_sentences_2['text'])))

        group_indexes = get_group_indexes(diff)

        #for d in diff:
        #    print(d)
        
        #for g in group_indexes:
        #    print(g)

        times_after_diff.append(time.time())

        index_in_1 = -1
        index_in_2 = -1
        #print("======================")
        for group in group_indexes:
            new_sentence = {}
            new_sentence['index'] = len(all_sentences)
            if len(group) == 1:
                i = list(group.keys())[0]
                sign = group[i]

                if sign not in ['+', '-', ' ']:
                    raise Exception('Invalid sign')


                new_sentence['clean_sentence'] = diff[i][2:].strip()
                new_sentence['status'] = 'added' if sign == '+' else (
                                        'removed' if sign == '-' else 'neutral')
                
                if sign == '+':
                    new_sentence['added_after'] = [index_in_1]


                if sign == ' ' or sign == '-':
                    index_in_1 += 1
                    new_sentence['section1'] = clean_sentences_1['section'][index_in_1]
                    new_sentence['ids1'] = clean_sentences_1['id'][index_in_1]
                    new_sentence['startIdx1'] = clean_sentences_1['startIdx'][index_in_1]
                    new_sentence['endIdx1'] = clean_sentences_1['endIdx'][index_in_1]
                    new_sentence['locList1'] = clean_sentences_1['locList'][index_in_1]
                
                if sign == ' ' or sign == '+':
                    index_in_2 += 1
                    new_sentence['section2'] = clean_sentences_2['section'][index_in_2]
                    new_sentence['ids2'] = clean_sentences_2['id'][index_in_2]
                    new_sentence['startIdx2'] = clean_sentences_2['startIdx'][index_in_2]
                    new_sentence['endIdx2'] = clean_sentences_2['endIdx'][index_in_2]
                    new_sentence['locList2'] = clean_sentences_2['locList'][index_in_2]

            else:
                signs = list(group.values())

                if signs not in [['-', '+', '?'], ['-', '?', '+', '?'], ['-', '?', '+']]:
                    raise Exception('Invalid signs')
                keys = list(group.keys())

                index_in_1 += 1
                index_in_2 += 1

                i1 = keys[0]
                i2 = keys[1] if signs == ['-', '+', '?'] else keys[2]

                new_sentence['clean_sentence'] = diff[i1][2:].strip()
                new_sentence['clean_sentence2'] = diff[i2][2:].strip()
                new_sentence['ids1'] = clean_sentences_1['id'][index_in_1]
                new_sentence['ids2'] = clean_sentences_2['id'][index_in_2]
                new_sentence['section1'] = clean_sentences_1['section'][index_in_1]
                new_sentence['section2'] = clean_sentences_2['section'][index_in_2]
                new_sentence['startIdx1'] = clean_sentences_1['startIdx'][index_in_1]
                new_sentence['startIdx2'] = clean_sentences_2['startIdx'][index_in_2]
                new_sentence['endIdx1'] = clean_sentences_1['endIdx'][index_in_1]
                new_sentence['endIdx2'] = clean_sentences_2['endIdx'][index_in_2]
                new_sentence['locList1'] = clean_sentences_1['locList'][index_in_1]
                new_sentence['locList2'] = clean_sentences_2['locList'][index_in_2]
                new_sentence['status'] = 'modified'
                new_sentence['modifications'] = [diff[keys[2]]] if signs == ['-', '?', '+'] else (
                                        [diff[keys[1]],diff[keys[3]]] if signs == ['-', '?', '+', '?'] else [diff[keys[1]]])


            all_sentences.append(new_sentence)


            
        times_afer_all_sentences.append(time.time())

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

        times_after_merging_links.append(time.time())


        all_sentences2 = list(filter(lambda x: x['status'] != 'removed', all_sentences))

        for _, link in added_links.iterrows():
            
            if link['section_2'] in UNRELEVENT_SECTIONS:
                continue
            
            sentences = list(filter(lambda x: int(link['sentid_2']) in x['ids2'], all_sentences2))

            '''
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
            '''

            sentence = list(sentences)[0]

            # get target title
            target_title = fix_target_titles(
                link['link'][6:].split('#')[0], redirect_1, redirect_2)
            
            all_contexts = create_all_contexts(
                section_sentences, args.side_contexts_size)
        
            section = sentence['section2'] 

            if sentence['status'] == 'neutral':
                missing_category = 'missing_mention'
            elif section not in section_sentences:
                    missing_category = 'missing_section'  
            elif sentence['status'] == 'modified':
                missing_category = 'missing_mention_with_sentence_modification'
            else:
                if all_sentences[max(sentence['index'] - 1, 0 )]['status'] != 'added' and all_sentences[min(sentence['index'] + 1, len(all_sentences) - 1)]['status'] != 'added':
                    missing_category = 'missing_sentence'
                else:
                    missing_category = 'missing_span'
                    
            
            if target_title in input['versions'][second_version]:
                if missing_category == 'missing_mention' or missing_category == 'missing_mention_with_sentence_modification':
                    insert_index = sentence['ids1']
                elif missing_category == 'missing_sentence' or missing_category == 'missing_span':
                    insert_index = sentence['added_after']
                else: insert_index = None

                output.append({
                    'source_title': input['source_title'],
                    'source_ID': input['source_ID'],
                    'target_title': target_title,
                    'context': None,
                    'insert_indices': insert_index,
                    'link_sentence': sentence['clean_sentence'],
                    'link_text': link['text_2'],
                    'section': section,
                    'mention_present': None,
                    'source_lead': original_lead.strip(),
                    'first_version': input['first_version'],
                    'second_version': second_version,
                    'direct_match': None,
                    'missing_category': missing_category,
                    'all_contexts': all_contexts
                })
                found_links.append(output[-1])

    times_after_processing_links.append(time.time())

    time_for_parsing_1 = time_after_parsing_1 - start_time
    time_for_cleaning_1 = time_after_cleaning_1 - time_after_parsing_1
    times_for_parsing_2 = []
    if len(times_after_parsing_2) > 0:
        times_for_parsing_2.append(times_after_parsing_2[0] - time_after_cleaning_1)

    for i in range(1, len(times_after_parsing_2)):
        times_for_parsing_2.append(times_after_parsing_2[i] - times_after_processing_links[i-1])
    
    times_for_cleaning_2 = [times_afer_cleaning_2[i] - times_after_parsing_2[i] for i in range(len(times_afer_cleaning_2))]
    times_for_diff = [times_after_diff[i] - times_afer_cleaning_2[i] for i in range(len(times_after_diff))]
    times_for_all_sentences = [times_afer_all_sentences[i] - times_after_diff[i] for i in range(len(times_afer_all_sentences))]
    times_for_merging_links = [times_after_merging_links[i] - times_afer_all_sentences[i] for i in range(len(times_after_merging_links))]
    times_for_processing_links = [times_after_processing_links[i] - times_after_merging_links[i] for i in range(len(times_after_merging_links))]

    total_time = times_after_processing_links[-1] - start_time

    '''print(f"Time for parsing 1: {time_for_parsing_1}")
    print(f"Time for cleaning 1: {time_for_cleaning_1}")
    print(f"Times for parsing 2: {times_for_parsing_2}")
    print(f"Times for cleaning 2: {times_for_cleaning_2}")
    print(f"Times for diff: {times_for_diff}")
    print(f"Times for all sentences: {times_for_all_sentences}")
    print(f"Times for merging links: {times_for_merging_links}")
    print(f"Times for processing links: {times_for_processing_links}")
    print(f"Total time: {total_time}")'''


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
    
    revisions_clean = sorted(revisions_clean, key=lambda x: len(x['versions']), reverse=True)[:100]
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

    df_output['source_lead'] = df_output['source_lead'].progress_apply(
        fix_text)
    
    df_output.to_parquet(os.path.join(args.output_dir, f'test_data.parquet'))

