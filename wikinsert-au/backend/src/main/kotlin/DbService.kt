package com.example

class DbService() {
    val db = mutableListOf(
        Sentence("1", "Hello, World!", 0), Sentence("2", "Goodbye, World!", 0)
    )

    fun getSentence(id: String): Sentence? {
        return db.find { it.id == id }
    }

    fun addSentence(sentence: Sentence) {
        db += sentence
    }}
data class Sentence(
    val id: String,
    val content: String,
    val score: Int
)

