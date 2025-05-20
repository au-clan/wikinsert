package com.example

import com.mongodb.client.model.Filters
import kotlinx.serialization.Serializable
import java.security.MessageDigest

interface DbService {
    suspend fun getScores(
        srcRevisionId: String,
        srcTitle: String,
        targetTitle: String,
        lang: String
    ): List<SentenceData>

    suspend fun getTargetsForSourceArticleBySearchQuery(
        sourceTitle: String,
        lang: String,
        query: String
    ): List<FilteredArticleResponseData>

    suspend fun getArticlesBySearchQuery(
        query: String,
        lang: String,
    ): List<FilteredArticleResponseData>
}

/**
 * MongoDB implementation of DbService
 */
class MongoDbService(
    private val articleRepository: ArticleRepository,
    private val targetRepository: TargetRepository,
    private val articleScoreRepository: ArticleScoreRepository
) : DbService {

    override suspend fun getTargetsForSourceArticleBySearchQuery(
        sourceTitle: String,
        lang: String,
        query: String
    ): List<FilteredArticleResponseData> {
        val sourceArticle = articleRepository.getByTitle(sourceTitle) ?: return emptyList()
        println("Source article: $sourceArticle")
        val targetNames = sourceArticle.targets ?: return emptyList()
        val targetIds = targetNames.map { name -> generateTargetId(lang, name) }
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
                thumbnail = article.thumbnail
            )
        }
    }

    override suspend fun getArticlesBySearchQuery(
        query: String,
        lang: String
    ): List<FilteredArticleResponseData> {
        val escapedQuery = Regex.escape(query)
        val pattern = ".*$escapedQuery.*"
        val regexOptions = "i"  // i for case-insensitive

        val dbQuery =
            Filters.and(
                Filters.eq("lang", lang),
                Filters.or(
                    Filters.regex("title", pattern, regexOptions),
                    Filters.regex("description", pattern, regexOptions),
                )
            )

        val filteredArticles = articleRepository.applyBsonFilter(dbQuery)
        println("Filtered articles: $filteredArticles")
        return filteredArticles.map { article ->
            FilteredArticleResponseData(
                title = article.title,
                lang = article.lang,
                description = article.description,
                thumbnail = article.thumbnail,
                revid = article.revid
            )
        }
    }

    override suspend fun getScores(
        srcRevisionId: String,
        srcTitle: String,
        targetTitle: String,
        lang: String
    ): List<SentenceData> {
        val sourceId = generateArticleId(lang, srcTitle, srcRevisionId)
        val targetId = generateTargetId(lang, targetTitle)
        println("Target not lowercase: ${generateTargetId(lang, targetTitle)}")
        println("Source not lowercase: ${generateArticleId(lang, srcTitle, srcRevisionId)}")

        val pairId = generatePairId(lang, sourceId, targetId)

        println("Pair ID: $pairId")

        val articleScore = articleScoreRepository.getScoresByPairId(pairId)

        println("Article score: $articleScore")

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


    private fun generatePairId(lang: String, sourceId: String, targetId: String): String {
        val input = "$lang$targetId$sourceId"
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
    val thumbnail: Thumbnail?,
    val revid: String? = null
)

@Serializable
data class SentenceData(
    val id: Int,
    val startOffset: Int,
    val endOffset: Int,
    val score: Double,
)
