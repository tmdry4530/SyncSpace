import { useEffect, useState } from 'react'
import * as Y from 'yjs'

export function useYDoc(roomName: string | null | undefined): Y.Doc | null {
  const [doc, setDoc] = useState<Y.Doc | null>(null)

  useEffect(() => {
    if (!roomName) {
      setDoc(null)
      return
    }

    const nextDoc = new Y.Doc()
    setDoc(nextDoc)

    return () => {
      nextDoc.destroy()
    }
  }, [roomName])

  return doc
}
