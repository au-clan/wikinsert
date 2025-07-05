# WikInsert

The recent study *Orphan Articles: The Dark Matter of Wikipedia* shows that nearly 15% of Wikipedia articles are orphans, meaning articles without any incoming links (Arora et al. 2023 [[1]](#1)). The rise in visibility of such articles necessitates their de-orphanization. A potential solution for such process relies on a cross multilingual approach: an article which is orphan in one langugage might not be in another language and it appears to be the case in 62% orphan articles. That said, when a potential source page is identified, it remains to insert into it the hyperlink to the target page.

![Alt](figures/link_insertion.png?raw=true)
Example of a link insertion within pre-existing text: `Sub-Saharan Africa`

Our work is the continuation of  *Multilingual Entity Insertion in Wikipedia* (Soares et al. 2023 [[2]](#2)), we will refer to it as **the previous study**. It defines the latter task as `Entity Insertion`. This is not a trivial task as it requires an editor reading most of the article to find the most suitable spot to insert a link. Also, the previous study of past link insertions shows that in more than 55% cases, the text piece in which the link appears was inserted along the link i.e. the piece of text did not exist prior the link insertion. Especially this complexifies the task and prevents strong classical baselines to work better than random. This previous study presents several LLMs to tackle this problem and shows good performance.

We present `WikInsert`, an AI-powered visualisation tool that aids in the `Entity Insertion` task by displaying several warm spots along the source page, getting a heat-map like visual, showing where a given hyperlink could be inserted. It converts the scores computed using the latter LLMs into a color palette. This offer flexibility and efficiency to the editors who may quickly find the best spots, while still being able to make the final decision, choosing between different warm spots. We provide several examples in different languages and use this tool to conduct a qualitative analysis, which should be considered along the quantitative analysis of the previous study.

## 1. Methods

### Overview

The detection of `warm insertion spots` relies on scoring of each sentence of the source page using an LLM. The higher the score, the more favorable the sentence is for inserting the given link "around", and the warmer the color of this sentence on the heat-map. By "around", we mean the link could be inserted direclty in the sentence, but also inserted along new text following this sentence. Hereby, we handle the 55% cases described above in which the piece of text does not exist prior link insertion. Regarding this, we define 7 missing link categories. They have been observed comparing two version of the same articels one month appart. While our model's role is not to predict these categories, defining them is important for understanding the task and later conducting qualitative analysis:
- *Missing mention*: the link is added in a pre-existing sentence. 
- *Missing sentence*: the link is added along a new sentence.
- *Missing span*: the link is added along a new span, which is defined as at least 2 sentences belonging to a same article section.
- *Missing section*: the link is added within a new article section, this case is filtered out since there is no relevent context to infer on. The LLMs of the previous study were not trained to tackle these cases.
- *Missing mention with sentence modifications*: the link is added in a pre-existing sentence, but which was modified. Modifications should be moderate enough so the sentence can still be recognized.
- *Missing mention in moved sentence*: the link is added in a pre-existing sentence that has been moved to a different spot on the page.
- *Missing mention in moved sentence with modifications*: the link is added in a pre-existing sentence, but which was mooved at a different spot of the page and which was modified. Modifications should be moderate enough so the sentence can still be recognized.

Note that the latter three were not considered at training and first evaluation stages in the previous study, but now we distinguish them for vizualization purposes in the qualitative analysis.

More precisely about the scoring, for each sentence of the source article, referred to as the `middle sentence`, we give it to the LLM within its context and along the `target lead`. The context comprehend a few sentences preceding the `middle sentence` as well as few sentences following it, constraining that the latter belong to same section the `middle setence` belongs to. The `target lead` is basically the introduction/top section of the target article.

The process to obtain the heat-maps of a source article is divided into 5 steps, as shown in the following figure:

![Alt](figures/big_picture.png?raw=true)
Big picture of the colouring process

### Step 1: Crawling pages

In the previous study, only the text was required, so it was enough to crawl the `.html` index exclusively. For our visualization purposes, we need to download all necessary files to closely resemble (if not exactly match) the pages as they appear on the Wikipedia website. We use the node js library `webstie_scraper` and perform an important modification of the pluggin `node_modules/website-scraper/lib/plugins/generate-filenamy-by-type-plugin.js` regarding the naming of the different crawled files. We crawl using the url format `https://${lang}.wikipedia.org/w/index.php?title=${title}&curid=${curid}&oldid=${oldid}` which allows us to select a specific version of a page and later conduct the qualitative analysis. We make sure to use the required selectors to considere all necessary files such as `{selector: 'img', attr: 'src'}`, `{selector: 'img', attr: 'srcset'}` etc.

### Step 2: Parsing the pages

Following the crawling of a Wikipedia page, we conduct parsing and tokenization of its text into sentences. While in the training phase, the extraction and sentence-tokenization of all text, along with its respective sections, sufficed, for visualization purposes, it is now imperative that our process facilitates the subsequent back mapping of each sentence to its original position in the raw, the position being encoded by the start and end index of a sentence when seing the html file as string. Specifically, for every segment of sentence associated with a single HTML node, we record the start and end indices of the curated text segment. Bellow is an illustration using a sample scenario:

```html
...<p>It was the first period of 1,000 years in the Anno Domini and Common Era. It is distinct from the millennium known as the <b>0s</b> which had 999 years that began on January 1, 1 AD and ended on December 31, 999 AD.</p>...
```
Please note that we consistently refer to the first section we encounter as the `lead`.

![Alt](figures/parsing_example.png?raw=true)
Example of parsing & tokenizing storing the indices.

Due to the absence of this feature in conventional Python libraries like Beautiful Soup, we resort to utilizing Node.js along with the jsdom library. This approach entails the use of XPath to precisely locate and assess sections, text pieces and hyperlinks within the HTML document. Subsequently, sentences within each section are identified using a sentence tokenizer. The task of storing the precise indices of each sentence presents a challenge, requiring a methodical iteration over nodes in parallel to sentences in order to capture the exact start and end positions within the raw HTML. Furthermore, hyperlinks within the text are identified as they will be essential for source-target pairing and ground-truth comparison.

### Step 3: Preprocessing

#### Cleaning of sentences
The initial stage of preprocessing is to clean the sentences text as follow:
- Removal of extra spaces at the beginning or end.
- Making sure it is "enough of" a sentence:
    - Contains more than 10 characters
    - Ends with a special character: `'.','!','?'` etc. (Languages for which it applies only)
- When a sentence does not meet the above conditions,  it is merged with the subsequent sentence if they belong to the same section. If not, it is merged with the preceding sentence if they belong to the same section. Otherwise, it remains unchanged.
- Any sentence exceeding 70 characters is considered valid in all cases to prevent unnecessary accumulation.

#### Extracting the source lead
We concatenate the sentences whose section is `lead` and store them as `source lead` as they could be used as `target lead` in the case the considered page is target of another.

#### Specific with-groundtruth and qualitative analysis preprocessing
For qualitative analysis, we handle two versions of the source page, spaced a month apart:
- Version 1 (v1): The base page used for computing scores and which will result in the heat-map.
- Version 2 (v2): The same page one month later, potentially containing additional hyperlinks (inserted links). No scoring or context building occurs on this page.
Here is how we pre-process in parallel both pages. Once the sentences of both pages are "clean" we:
- We employ the `compare` method from the python `difflib` library on the ordered lists of sentences from both versions.
- We process the `difflib compare` objects using its `+,-,?` symbols to detect the following cases:
    - *neutral*: sentence appears in both versions and remains unchanged.
    - *added*: sentence appears in v2 but not in v1.
    - *removed*: sentence appears in v1 but not in v2.
    - *modified*: sentence appears in both versions with minor/moderate differences, located at the same spot (modulo additions and removals).
- The difflib object does not detect when a sentence was moved or moved & modified since it relies on the order of appearance. To considere these we implement a fuzzy match based on a word frequency similarirty metric. This way we identify the folowing cases:
    - *moved*: sentence which appeared both as *added* and *removed* but which are in fact the same (similarity metric > 99%)
    - *moved with modifications*: sentence which appeared both as *added* and *removed* but which are in fact the same with lower similarity (> 68%)
Note: thresholds for similarity metrics are chosen heuristically.

## Categorization of Inserted Links

Once sentences are categorized, we determine the missing category for each inserted link in v2 that is not present in v1, based on the sentence it belongs to, let $sen$ be this sentence

- If $sen$ is:
  - *Added*
  - **AND** in a non-pre-existing section
  - -> *Missing Section*

- If $sen$ is:
  - *Neutral*
  - -> *Missing Mention*

- If $sen$ is:
  - *Added*
  - **AND** the preceding sentence is not *added* or belongs to a different section
  - **AND** the following sentence is not *added* or belongs to a different section
  - -> *Missing Sentence*

- If $sen$ is:
  - *Added*
  - **AND** 
    - the preceding sentence is *added* and belongs to the same section 
    - **OR** the following sentence is *added* and belongs to the same section
  - -> *Missing Span*

- If $sen$ is:
  - *Modified*
  - -> *Missing Mention with Modifications*

- If $sen$ is:
  - *Moved*
  - -> *Missing Mention in Moved Sentence*

- If $sen$ is:
  - *Moved with Modifications*
  - -> *Missing Mention in Moved Sentence with Modifications*

The *missing section* links are filtered out because the LLMs of the previuosu study were not trained to support this case, hence there is no point of conducting a qualitative analysis on them. The locations of *added* sentences, *moved* sentences, etc. are stored. These will be utilized when displaying the ground truth along the heatmap.
 
#### Building the contexts
For each sentence, called the `middle sentence` we construct the input of the model that we call context. Given the `context size` parameter $k$, it consists in the concatenation of:
    - the $k$ preceding sentences
    - the `middle sentence`
    - the $k$ following sentences
The preceding and following sentence must belong to same section the `middle sentence` belongs to. In case there are not enough such sentences we take the maximum < $k$ on each side we can.

![Alt](figures/context_construction.png?raw=true)

Construction of context $l$ of sentence $l$

Note that we have now implemented to possibility of chossing the $k$ parameter for further study; although we kept to the original the orginal value whcih was used for training: 5.
 
#### Merging
For each target we considere, either found by the specific with-groundtruth and qualitative analysis preprocessing or given as input, we must extract its lead paragraph. This wasc already done drugin the previsous study for most pages we considere now but otherwise, it can be extracted as it is done in above following parsing.

### Step 4: Scoring the contexts

We use the LLMs trained in the previous study, more precisely the one we use predomenanlty is a fine-tuned version of `Roberta` [[3]](#3): `roberta_full_multilingual-all` as it was the one showing the best performaces accros several languages. The final input corresponding to one sentence of the `source article` is the concatenation of:
    - the `target title`
    - the `target lead section`
    - the `context` associated to this sentence
We then get a float score for each sentence of the `source article`. 

### Step 5: Colouring the contexts

- The next step is to normalize the scores across the source article:
$$ \forall \text{score} \in \text{scores},\quad  \text{normalized\_score} = \frac{\text{score} - \min(\text{scores})}{\max_{sc \in \text{scores}}(\text{sc} - \min(\text{scores}))}$$
This way we make sure that all scores are in $[0,1]$ and that the maximum socres is 1 and the minimum is 0. 
- We map each normalized score to a color using color map. We chose `sns.color_palette("coolwarm", as_cmap=True)` which, rougly, goes from gray to red.
- On top of this we add a transparency paramter:
$$\alpha(\text{{score}}) = (\text{score} + 0.3)/4$$
which was heuristically chosen.
- Once each score is mapped to a color, resulting in each sentence being mapped to a color, we can construct the heat-map page:
    - We iterate accross each sub sentence (i.e part of the sentence wich belong to a single html node, as defined above) to progressively construct the final html string. Namely, let `sub_sen` be the current sub sentence with start index $s$, end index $e$, color $c$ and `final_html` be the current state of the final input. At this step:
    ```javascript
        final_html = final_html + orignal_html.substring(last_e,s) //adding the orginal html parts that are not conserned by colouring
        final_html = final_html + `<span style="background-color: rgba(c)">${orignal_html.substring(s,e)}</span>`; //adding the coloured sub_sentence, using the stored indices
        last_e = e
  
    ```
    - For qualitative analysis, we also add special visual markers to meterialize the ground-truth.

## 2. A few results

We ran the process on languages *Simple* (simple english), *French*, *German* and *Spanish* on a random sample of 100 source pages. We usually obtain more than one heat-map per source page in case there are several targets for one source (i.e more tha one link is inserted from one month to the other). The pages we use are from October (v1) and November (v2) 2023. We diaplay a few examples here, but you may observe many more in `dlabdata1/boulenge/wikidumps_data/report_examples.zip`. Download the zip file locally, open one of the files in `colored_pages` and choose the heat map you want to see. Ground-Truth insertions are preceded and followed by `[GT]`.

- *Missing mention*:
![Alt](figures/missing_mention_example.png?raw=true)
The underlined + overlined sentence is the one the link was inserted in. The inserted link shown at the end of this sentence. As we can see, this senence is in the region where it is roughly the warmest.
- *Missing sentence*: 
![Alt](figures/missing_sentence_example.png?raw=true)
- *Missing span*:
![Alt](figures/missing_span_example.png?raw=true)
- *Missing mention with sentence modifications*:
![Alt](figures/missing_mention_with_modifications.png?raw=true)
- *Moved sentence*:
This is a rare case and it was not present in our current sample.
- *Moved sentence with modifications*:
![Alt](figures/missing_mention_moved_sentence_modif_example.png?raw=true)
We display the sentence where it is originally and materialize where it was moved with `sentence_moved_here`.

Here we are showing a few examples only, a more detailed and larger scale qulitative analysis will be conducted later.

## 3. The source code

Please refer to the notebook `demo_nb.ipynb` to see the whole process in action. It was use to generate the above examples

## 4. Future work

- Generalize to and evaluate on more languages, especially the tokenizing into sentences
- Perfectionning of the colouring, smoothing parameter etc.
- Creation of a Dlab hosted server to observe several heat-maps
- Implementation of the non ground-truth process on new pages


## References
<a id="1">[1]</a> 
Arora et al. *Orphan Articles: The Dark Matter of Wikipedia*. arXiv [Cs.SI], 6 June 2023, http://arxiv.org/abs/2306.03940. arXiv.

<a id="2">[2]</a> 
Soores et al. *Multilingual Entity Insertion in Wikipedia*
Jan 2024

<a id="3">[3]</a> 
Yinhan Liu and Myle Ott and Naman Goyal and Jingfei Du and Mandar Joshi and Danqi Chen and Omer Levy and Mike Lewis and Luke Zettlemoyer and Veselin Stoyanov, 2019
*RoBERTa: A Robustly Optimized BERT Pretraining Approach*. arXiv [cs.CL], 2019, https://arxiv.org/abs/1907.11692