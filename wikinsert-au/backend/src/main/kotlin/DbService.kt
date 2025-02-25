package com.example

interface DbService {
    fun getScoresForSentenceHashes(sentenceHashes: List<String>): List<SentenceScorePair>
}

class DbServiceMock : DbService {
    private val hardcodedScores = listOf(
        SentenceScorePair("hash1", 925),
        SentenceScorePair("hash2", 8123),
        SentenceScorePair("hash3", 2321),
    )
    override fun getScoresForSentenceHashes(sentenceHashes: List<String>): List<SentenceScorePair> {
        return hardcodedScores
    }
}

data class SentenceScorePair(
    val hash: String,
    val score: Int
)



