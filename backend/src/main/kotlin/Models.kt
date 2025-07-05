package com.example

import kotlinx.serialization.Serializable

/**
 * Data classes for MongoDB collections
 */

/**
 * Represents an article in the articles collection
 */
@Serializable
data class Article(
    val _id: String,
    val lang: String,
    val title: String,
    val revid: String,
    val thumbnail: Thumbnail?,
    val description: String?,
    val targets: List<String>?,
)

@Serializable
data class Thumbnail(
    val source: String?,
    val width: Int?,
    val height: Int?
)


/**
 * Represents a sentence in an article
 */
@Serializable
data class Sentence(
    val idx: Int,
    val start: Int,
    val end: Int,
    val sentence: String
)

/**
 * Represents a section in an article
 */
@Serializable
data class Section(
    val title: String,
    val sentences: List<Sentence>
)

/**
 * Represents the content of an article in the article_contents collection
 */
@Serializable
data class ArticleContent(
    val _id: String,
    val sections: List<Section>
)

/**
 * Represents a score for a sentence in the article_scores collection
 */
@Serializable
data class SentenceScore(
    val idx: Int,
    val start: Int,
    val end: Int,
    val score: Double
)

/**
 * Represents scores for sentences in the article_scores collection
 */
@Serializable
data class ArticleScore(
    val _id: String,
    val scores: List<SentenceScore>
)

@Serializable
data class Target(
    val _id: String,
    val title: String,
    val lang: String,
    val lead: String,
    val thumbnail: Thumbnail?,
    val description: String,
)
