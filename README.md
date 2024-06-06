# WikInsert

The recent study *Orphan Articles: The Dark Matter of Wikipedia* shows that nearly 15% of Wikipedia articles are orphans, meaning articles without any incoming links (Arora et al. 2023 [[1]](#1)). The increase in visibility of such articles requires their de-opranization. A potential solution for such process relies on a cross multilingual approach: an article which is orphan in one langugage might not be in another language and it appears to be the case in 62% orphan articles. That said, when a potential source page is identified, it remains to insert the hyperlink to the target page.

![Alt](figures/link_insertion.png?raw=true)
Example of a link insertion within pre-existing text: `Sub-Saharan Africa`

Our work is the continuation of  *Multilingual Entity Insertion in Wikipedia* (Soares et al. 2023 [[2]](#2)). It defines the latter task as `Entity Insertion`. This is not a trivial task as it requires an editor reading most of the article to find the most suitable spot to insert a link. Also, the study of past link insertions shows that in more than 55% cases, the text in which the link is was inserted along the link i.e. the piece of text did not exist prior the link insertion. Especially this complexifies the task and prevents strong classical baselines to work better than random. This previous study presents several LLMs to tackle this problem and shows good performance

We present `WikInsert`, an AI-powered visualisation tool that aids in the `Entity Insertion` task by displaying several warm spots along the source page, showing where a given hyperlink could be inserted. It converts the scores computed using the latter LLMs into a color palette. This offer flexibility and efficiency to the editors who may quickly find the best spots, while still being able to make the final decision, choosing within different warm spots. We provide several examples in different languages and use this tool to conduct a qualitative analysis, which should be considered along the quantitative anlysis of the previous study.

## 1. Methods

### 1.1 Overview

The detection of `warm insertion spots` relies on the scoring of each sentence of the source page using an LLM, the higher the score, the more relevent the sentence is to insert the given link "around" and the warmer the color of this sentence is on the final ouptut. By "around", we mean that the link could be inserted direclty in the sentence, but also inserted along new text following this sentence. Hereby, we handle the 55% cases described above in which the piece of text did not exist prior the link insertion. About this we define 7 missing link categories. Our model's role is not to predict these, but they are imprtant to define to understand the task and latter conduct qulitative analysis:
- *Missing mention*: the link is added in a pre-existing sentence. 
- *Missing sentence*: the link is added along a new sentence.
- *Missing span*: the link is added along a new span, which is defined as at least 2 sentences within a sinlge section.
- *Missing section*: the link is added within a new section, this case is filter out since there is no relevent context to infer on.
- *Missing mention with sentence modifications*: the link is added in a pre-existing sentence, but which was modified. Modifications should be moderate enough so the sentence can still be recognized.
- *Moved sentence*: the link is added in a pre-existing sentence, but whic was mooved at a different spot of the page.
- *Moved sentence with modifications*: the link is added in a pre-existing sentence, but which was mooved at a different spot of the page and which was modified. Modifications should be moderate enough so the sentence can still be recognized.

Note that the latter three were not considered at training and first evaluation stages in the previous study, but now we distinguish them for vizualization purposes in the qualitative analysis.

More precisely about the scoring, for each sentence of the source article, say the `middle sentence`, we give it to the LLM within its context and along the `target lead`. The context comprehend the $k$ sentences prior the `middle sentence` as well as the $k$ sentences after, constraining that they belong to same section the `middle setence` belongs to. The `target lead` is basically the introduction/top section of the target article.

The process of colouring the pages is divided into 5 steps, as shown in the following figure:

![Alt](figures/big_picture.png?raw=true)
Big picture of the colouring process

### 1.2  Step 1: Crawling pages

At training stage only the text was required and hence we could crawl the `.html` index only. For our visualization purposes, we need to download all files necessary to achieve a close resemblance (if not an exact match) to the pages as they appear on the Wikipedia website. We use the node js library `webstie_scraper` and perform an important modification of the pluggin `node_modules/website-scraper/lib/plugins/generate-filenamy-by-type-plugin.js` regarding the naming of the different crawled files. We crawl using the url format `https://${lang}.wikipedia.org/w/index.php?title=${title}&curid=${curid}&oldid=${oldid}` which allows us crawl specific version of a page and later conduct a the qualitative analysis. We make sure to use the required selectors to considere all necessary files such as `{selector: 'img', attr: 'src'}`, `{selector: 'img', attr: 'srcset'}` etc.

### 1.3 Step 2: Parsing the pages

Once a page is crawled we need to parse it and tokenize its text into sentences. At training stage it was enough to extract all the text along the sections and tokenize it. Now, for the visulization purpose, we need to ba able to input back a sentence in the original index. To do so, we have to store the raw html start and end indices of each sentence.
- More precisely each peace of text within a single html node 
- can't use Beatiful soup so node js : jsdom
- Xpath evaluation and then... 
- Finding the sections
- Finindg the sentences, challenging to store the exact indices, must loop over etc.
- Finding the links

### 1.4 Step 3: Preprocessing

#### 1.4.1 Preprocessing with groundtruth for qualitative analysis

#### 1.4.2 Preprocessing for inference only

### 1.4 Step 4: Scoring the contexts

### 1.5 Step 5: Colouring the contexts

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