# WikInsert

The recent study *Orphan Articles: The Dark Matter of Wikipedia* shows that nearly 15% of Wikipedia articles are orphans [quote], meaning articles without any incoming links. The increase in visibility of such articles requires their de-opranization. A Potantial solution for such process relies on a cross multilingual approach: an article which is orphan in one langugage might not be in another language and it appears to be the case in 62% orphan articles [quote]. That said, when a potential source page is identified, it remains to insert the hyperlink to the target page.

![Alt](figures/link_insertion.png?raw=true)
Example of a link insertion within pre-existing text: `Sub-Saharan Africa`

This task was defined as `Entity Insertion` in the previous study *Multilingual Entity Insertion in Wikipedia* [quote]. This is not a trivial task as it requires an editor reading most of the article to find the most suitable spot to insert a link. Also, the study of past link insertions shows that in more than 55% cases, the text in which the link is was inserted along the link i.e. the piece of text did not exist prior the link insertion. Especially this complexifies the task and prevents strong classical baselines to work better than random. This previous study presents several LLMs to tackle this problem and shows good performance

We present `WikInsert`, an AI-powered visualisation tool that aids in the `Entity Insertion` by displaying several warm spots along the source page, showing where a given hyperlink could be inserted. It converts the scores computed using the latter LLMs into a color palette. This offer flexibility and efficiency to the editors who may quickly find the best spots, while still being able to make the final decision, choosing within different warm spots. We provide several examples in different languages and us this tool to conduct a qualitative analysis, which should be considered along the quantitative anlysis of the previous study.

## 1. Methods

The detection of "warm spots" relies on the scoring of each sentence of the source page using an LLM, the higher the score, the more relevent the senetence is to insert the given link and the warmer the color is on the final ouptut. More precisely, we give the LLM a a sentence, say the `middle sentence`, within its context and along `target lead`. The context comprehend the $k$ sentences prior the `middle sentence` as well as the $k$ sentences after, constraining that they belong to the same section. The `target lead` is basically the introduction/top section of the target article.

The process of colouring the pages is divided into 4 steps, as shown in the following figure:

[Big picture figure]

### 1.1 Crawling pages

At training stage only the text was required and hence we could crawl the `.html` index only. Now, fro our vizualization purpose we doownload all files necessary for qasi-exact similarity with the pasges we can read on the Wikipedia website itself. We use 

### 1.2 Parsing the pages

### 1.3 Preprocessing

### 1.4 Scoring the contexts


## 2. Results and qualitative analysis

## 3. Mored detals about the source code, how to use the tool?





























## Bibliographie

https://arxiv.org/pdf/2306.03940V