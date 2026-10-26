"""Open the .docx in headless LibreOffice, update the table of contents (page numbers),
then save an updated .docx and a PDF next to it.  Usage: python update_toc.py report.docx"""
import os, subprocess, sys, time
import uno
from com.sun.star.beans import PropertyValue

def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p

src = os.path.abspath(sys.argv[1])
proc = subprocess.Popen(["soffice", "--headless", "--invisible", "--norestore",
                         "--accept=socket,host=127.0.0.1,port=2002;urp;"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ctx = None
local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
for _ in range(60):
    try:
        ctx = resolver.resolve("uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext"); break
    except Exception:
        time.sleep(0.5)
desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), "_blank", 0, (prop("Hidden", True),))
idx = doc.getDocumentIndexes()
for i in range(idx.getCount()):
    idx.getByIndex(i).update()
doc.refresh()
for i in range(idx.getCount()):   # second pass: TOC length can shift page numbers
    idx.getByIndex(i).update()
base = os.path.splitext(src)[0]
doc.storeToURL(uno.systemPathToFileUrl(base + ".pdf"), (prop("FilterName", "writer_pdf_Export"),))
doc.storeToURL(uno.systemPathToFileUrl(base + "_toc.docx"), (prop("FilterName", "MS Word 2007 XML"),))
doc.close(True)
proc.terminate()
print("updated", idx.getCount(), "index(es)")
