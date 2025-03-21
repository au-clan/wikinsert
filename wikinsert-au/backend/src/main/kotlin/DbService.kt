package com.example

import kotlinx.serialization.Serializable

interface DbService {
    fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData>
}

class DbServiceMock : DbService {


    override fun getSourceTargetPairs(srcRevisionId: String, targetRevisionId:String, srcTitle: String, targetTitle:String, lang: String): List<SentenceData> {
        return listOf(
            SentenceData( 1,0, 0,323, 0.5),
            SentenceData( 2,1,0,124, 0.6),
            SentenceData( 3,1,124, 184, 0.7),
            SentenceData( 4,1, 184, 265, 0.82),
            SentenceData( 5,2,0,296, 0.95),


        )
    }
}


@Serializable
data class SentenceData(
    val id : Int,
    val pTagId: Int,
    val relStartOffset: Int,
    val relEndOffset: Int,
    val score: Double,
)



