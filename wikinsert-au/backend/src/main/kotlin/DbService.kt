package com.example

import com.mongodb.client.model.Filters
import kotlinx.serialization.Serializable
import java.security.MessageDigest
import java.util.*

interface DbService {
    suspend fun getScores(
        srcRevisionId: String,
        srcTitle: String,
        targetTitle: String,
        lang: String
    ): List<SentenceData>

    suspend fun filterArticlesBySearch(
        sourceTitle: String,
        langCode: String,
        query: String
    ): List<FilteredArticleResponseData>
}

/**
 * Mock implementation of DbService for testing

class DbServiceMock : DbService {
override suspend fun getScores(srcRevisionId: String, targetRevisionId: String, srcTitle: String, targetTitle: String, lang: String): List<SentenceData> {
        return listOf(
SentenceData(1, 0, 304, 0.5),
SentenceData(2, 304, 428, 0.6),
SentenceData(3, 428, 488, 0.7),
SentenceData(4, 488, 569, 0.82),
SentenceData(5, 569, 863, 0.95),
SentenceData(5, 863, 910, 0.95),
SentenceData(5, 910, 1030, 0.95),
)
}
}
 */

/**
 * MongoDB implementation of DbService
 */
class MongoDbService(
    private val articleRepository: ArticleRepository,
    private val targetRepository: TargetRepository,
    private val articleScoreRepository: ArticleScoreRepository
) : DbService {

    override suspend fun filterArticlesBySearch(
        sourceTitle: String,
        langCode: String,
        query: String
    ): List<FilteredArticleResponseData> {
        val sourceArticle = articleRepository.getByTitle(sourceTitle) ?: return emptyList()
        println("Source article: $sourceArticle")
        val targetIds = sourceArticle.targets ?: return emptyList()
        val pattern = ".*$query.*"
        val regexOptions = "i"  // i for case-insensitive

        val dbQuery = Filters.and(
            Filters.`in`("_id", targetIds),
            Filters.or(
                Filters.regex("title", pattern, regexOptions),
                Filters.regex("description", pattern, regexOptions),
                Filters.regex("lead", pattern, regexOptions),
            )
        )

        val filteredArticles = targetRepository.applyBsonFilter(dbQuery)
        println("Filtered articles: $filteredArticles")
        return filteredArticles.map { article ->
            FilteredArticleResponseData(
                title = article.title,
                lang = article.lang,
                description = article.description,
                thumbnailUrl = article.thumbnail.source
            )
        }
    }

    override suspend fun getScores(
        srcRevisionId: String,
        srcTitle: String,
        targetTitle: String,
        lang: String
    ): List<SentenceData> {
        val lowerCaseSrc = srcTitle.lowercase(Locale.getDefault())
        val lowerCaseTarget = targetTitle.lowercase(Locale.getDefault())
        val sourceId = generateArticleId(lang, lowerCaseSrc, srcRevisionId)
        val targetId = generateTargetId(lang, lowerCaseTarget)

        val pairId = generatePairId(sourceId, targetId)

        val articleScore = articleScoreRepository.getScoresByPairId(pairId)

        return articleScore?.scores?.map { score ->
            SentenceData(
                id = score.idx,
                startOffset = score.start,
                endOffset = score.end,
                score = score.score
            )
        } ?: emptyList()
    }

    private fun generateArticleId(lang: String, title: String, revid: String): String {
        val input = "$lang$title$revid"
        return md5(input)
    }


    private fun generatePairId(sourceId: String, targetId: String): String {
        val input = "$sourceId$targetId"
        return md5(input)
    }

    private fun generateTargetId(lang: String, title: String): String {
        val input = "$lang$title"
        return md5(input)
    }

    private fun md5(input: String): String {
        val md = MessageDigest.getInstance("MD5")
        val digest = md.digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}

@Serializable
data class FilteredArticleResponseData(
    val title: String,
    val lang: String,
    val description: String?,
    val thumbnailUrl: String?
)

@Serializable
data class SentenceData(
    val id: Int,
    val startOffset: Int,
    val endOffset: Int,
    val score: Double,
)
