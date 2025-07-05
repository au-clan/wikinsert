export type HTMLSentenceMapping = {
    id: number;
    startOffset: number;
    endOffset: number;
    score: number;
};

export type TextNode = {
    node: Text;
    start: number;
    end: number;
};
