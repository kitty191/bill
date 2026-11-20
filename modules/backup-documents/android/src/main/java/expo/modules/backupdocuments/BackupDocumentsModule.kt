package expo.modules.backupdocuments

import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BackupDocumentsModule : Module() {
  private val resolver get() = checkNotNull(appContext.reactContext).contentResolver

  override fun definition() = ModuleDefinition {
    Name("BackupDocuments")
    AsyncFunction("displayName") { uri: String ->
      resolver.query(Uri.parse(uri), arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null)
        ?.use { if (it.moveToFirst()) it.getString(0) else null }
        ?: throw IllegalStateException("无法读取备份文件名")
    }
    AsyncFunction("listFiles") { uri: String ->
      val tree = Uri.parse(uri)
      val parent = if (tree.pathSegments.getOrNull(2) == "document") DocumentsContract.getDocumentId(tree)
        else DocumentsContract.getTreeDocumentId(tree)
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent)
      val columns = arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE)
      val result = mutableListOf<Map<String, String>>()
      resolver.query(children, columns, null, null, null)?.use { cursor ->
        while (cursor.moveToNext()) {
          if (cursor.getString(2) == Document.MIME_TYPE_DIR || cursor.isNull(1)) continue
          val child = DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0))
          result.add(mapOf("name" to cursor.getString(1), "uri" to child.toString()))
        }
      } ?: throw IllegalStateException("无法读取备份目录")
      result
    }
  }
}
