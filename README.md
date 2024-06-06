# WikInsert

The recent study *Orphan Articles: The Dark Matter of Wikipedia* shows that nearly 15% of Wikipedia articles are orphans, meaning articles without any incoming links (Arora et al. 2023 [[1]](#1)). The increase in visibility of such articles requires their de-opranization. A potential solution for such process relies on a cross multilingual approach: an article which is orphan in one langugage might not be in another language and it appears to be the case in 62% orphan articles. That said, when a potential source page is identified, it remains to insert the hyperlink to the target page.

![Alt](figures/link_insertion.png?raw=true)
Example of a link insertion within pre-existing text: `Sub-Saharan Africa`

Our work is the continuation of  *Multilingual Entity Insertion in Wikipedia* (Soares et al. 2023 [[2]](#2)). It defines the latter task as `Entity Insertion`. This is not a trivial task as it requires an editor reading most of the article to find the most suitable spot to insert a link. Also, the study of past link insertions shows that in more than 55% cases, the text in which the link is was inserted along the link i.e. the piece of text did not exist prior the link insertion. Especially this complexifies the task and prevents strong classical baselines to work better than random. This previous study presents several LLMs to tackle this problem and shows good performance

We present `WikInsert`, an AI-powered visualisation tool that aids in the `Entity Insertion` task by displaying several warm spots along the source page, showing where a given hyperlink could be inserted. It converts the scores computed using the latter LLMs into a color palette. This offer flexibility and efficiency to the editors who may quickly find the best spots, while still being able to make the final decision, choosing within different warm spots. We provide several examples in different languages and use this tool to conduct a qualitative analysis, which should be considered along the quantitative anlysis of the previous study.

## 1. Methods

### Overview

The detection of `warm insertion spots` relies on the scoring of each sentence of the source page using an LLM, the higher the score, the more relevent the sentence is to insert the given link "around" and the warmer the color of this sentence is on the final ouptut. By "around", we mean that the link could be inserted direclty in the sentence, but also inserted along new text following this sentence. Hereby, we handle the 55% cases described above in which the piece of text did not exist prior the link insertion. About this we define 7 missing link categories. Our model's role is not to predict these, but they are imprtant to define to understand the task and latter conduct qulitative analysis:
- *Missing mention*: the link is added in a pre-existing sentence. 
- *Missing sentence*: the link is added along a new sentence.
- *Missing span*: the link is added along a new span, which is defined as at least 2 sentences within a sinlge section.
- *Missing section*: the link is added within a new section, this case is filter out since there is no relevent context to infer on.
- *Missing mention with sentence modifications*: the link is added in a pre-existing sentence, but which was modified. Modifications should be moderate enough so the sentence can still be recognized.
- *Missing mention in moved sentence*: the link is added in a pre-existing sentence, but whic was mooved at a different spot of the page.
- *Missing mention in moved sentence with modifications*: the link is added in a pre-existing sentence, but which was mooved at a different spot of the page and which was modified. Modifications should be moderate enough so the sentence can still be recognized.

Note that the latter three were not considered at training and first evaluation stages in the previous study, but now we distinguish them for vizualization purposes in the qualitative analysis.

More precisely about the scoring, for each sentence of the source article, say the `middle sentence`, we give it to the LLM within its context and along the `target lead`. The context comprehend the $k$ sentences prior the `middle sentence` as well as the $k$ sentences after, constraining that they belong to same section the `middle setence` belongs to. The `target lead` is basically the introduction/top section of the target article.

The process of colouring the pages is divided into 5 steps, as shown in the following figure:

![Alt](figures/big_picture.png?raw=true)
Big picture of the colouring process

### Step 1: Crawling pages

At training stage only the text was required and hence we could crawl the `.html` index only. For our visualization purposes, we need to download all files necessary to achieve a close resemblance (if not an exact match) to the pages as they appear on the Wikipedia website. We use the node js library `webstie_scraper` and perform an important modification of the pluggin `node_modules/website-scraper/lib/plugins/generate-filenamy-by-type-plugin.js` regarding the naming of the different crawled files. We crawl using the url format `https://${lang}.wikipedia.org/w/index.php?title=${title}&curid=${curid}&oldid=${oldid}` which allows us crawl specific version of a page and later conduct a the qualitative analysis. We make sure to use the required selectors to considere all necessary files such as `{selector: 'img', attr: 'src'}`, `{selector: 'img', attr: 'srcset'}` etc.

### Step 2: Parsing the pages

After a Wikipedia page is crawled, we parse it and tokenize its text into sentences. During the training phase, extracting and seentence-tokenizing all text along with its sections was enough. However, for visualization purposes, it is now essential that our process supports the later mapping of each sentence back to its original index in the raw HTML. To do so se implement the storage of the raw HTML start and end indices for each sentence. More precisely, for each piece of sentence belonging to a single html node, we store the start and end indices of the currated piece of text. Here is an example for the following sample:

```html
...<p>It was the first period of 1,000 years in the Anno Domini and Common Era. It is distinct from the millennium known as the <b>0s</b> which had 999 years that began on January 1, 1 AD and ended on December 31, 999 AD.</p>...
```

![Alt](figures/parsing_example.png?raw=true)
Example of parsing & tokenizing storing the indices.

As the use of usual `Python` libaries such as `Beautiful Soup` does not offer such feature, we us Node.js with the jsdom library. The process involves employing XPath to accurately locate and evaluate sections, sentences within the HTML document. Sentences within each section are then identified using a sentence tokenizer. Storing the precise indices of each sentence presents a challenge that necessitates iterating over the nodes in paralelly ot the sentences methodically to capture the exact start and end positions within the raw HTML. Additionally, hyperlinks within the text are identified as they are needed in source-target pairing and ground-truth comparison.

### Step 3: Preprocessing

#### Cleaning of sentences
The first part of the preprocessing is to clean the sentences text as follow:
- Removing extra spaces in the begining or at the end
- Making sure it is "enough of" a sentence:
    - Contains more than 10 characters
    - Ends with a special character: `'.','!','?'` etc. (Languages for which it applies only)
    - We do not require a capital as first letter as it 
- When a sentence does not verify the above, we merge it with the following sentence if it belongs to the same section, otherwise with the preceding sentence if it belongs to the same section, otherwise leave it as it is.
- We considere a sentence with more than 70 characters valid in any case to avoid accumulation.

#### Extracting the source lead
We concatenate the sentences whose section is `lead` and store them as `source lead` as they could be used as target lead in the case the considered page is target of another.

#### Specific with-groundtruth and qualitative analysis preprocessing
In the case of the qualitative analysis, we need to process two versions of the source page:
- A version 1, say v1, which is the page at time $t$ and is the one we are computing the score on and that we are colouring
- A version 2, say v2, wich is the page at time $t+1$ and that may contain more hyperlinks than the v1, the `insterted links`. No context is built nor scorea computed from this page.
Here is how we pre-process in parallel both pages. Once the sentences of both pages are "clean" we:
- Use the `compare` method from the `difflib` library on both list of sentences
- We process the `difflib compare` objects using its `+,-,?` symbols to detect the following cases:
    - *neutral*: sentence appears in both versions and remained unchanged
    - *added*: sentence appears in v2 but not in v1
    - *removed*: sentence appears in v1 but not in v2
    - *modified*: sentence appears in both versions but with a few difference. The sentences must be at the same spot (modulo additions and removals) and difference moderate.
- The difflib object does not detect when a sentence was moved or moved & modified since it relies on the order of appearance. To considere these we implement a fuzzy match based on a word frequency similarirty metric. This way we identify the folowing cases:
    - *moved*: sentence which appeared both as *added* and *removed* but which are in fact the same (similarity metric > 99%)
    - *moved with modifications*: sentence which appeared both as *added* and *removed* but which are in fact the same with lower similarity (> 68%)
    Note that the thresholds we heuristically chosen.

- Once the sentences are categorized, we look for the links that are in v2 but not in v1 and hereby determine the `missing category` for each of these `inserted link`, depending on the sentence they belong to:
    - -> *missing section*
        - *added* 
        - **AND** in a non pre-existing section 
    - -> *missing mention*
        - *neutral* 
    - -> *missing sentence*
        - *added* 
        - **AND** the preceding sentence is not *added* or belongs to a different section
        - **AND** the following sentence is not *added* or belongs to a different section 
    -  -> *missing span*
        - *added*  
        - **AND** 
            - the preceding sentence is *added* and belongs to the same section 
            - **OR** the following sentence is *added* and belongs to the same section
    - -> *missing mention with modifications*
        - *modified*
    - -> *Missing mention in moved sentence*
        - *moved*
    - -> *Missing mention in moved sentence with modifications*
        - *moved with modifications*
 
    


#### Building the contexts
For each sentence, called the `middle sentence` we construct the input of the model that we call context. Givan the `context size` parameter $k$, it consists in the concatenation of:
    - the $k$ preceding sentences
    - the `middle sentence`
    - the $k$ following sentences
The preceding and following sentence must belong to same section the `middle sentence` belongs to. In case there is not anough such senences we take the maximum < $k$ on each side we can.

![Alt](figures/context_construction.png?raw=true)

Construction of context $l$ of sentence $l$
 
- #### Merging

### Step 4: Scoring the contexts

### Step 5: Colouring the contexts

#### 1.5.1 Scores to colors

#### 1.5.2 Displaying the groundtruths

## 2. Results and qualitative analysis

- *Missing mention*:
- *Missing sentence*: 
- *Missing span*:
- *Missing section*:
- *Missing mention with sentence modifications*:
- *Moved sentence*:
- *Moved sentence with modifications*:

## 3. More details about the source code, how to use the tool?





























## References
<a id="1">[1]</a> 
Arora et al. *Orphan Articles: The Dark Matter of Wikipedia*. arXiv [Cs.SI], 6 June 2023, http://arxiv.org/abs/2306.03940. arXiv.

<a id="2">[2]</a> 
Soores et al. *Multilingual Entity Insertion in Wikipedia*