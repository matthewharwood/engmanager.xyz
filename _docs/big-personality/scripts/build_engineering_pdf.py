#!/usr/bin/env python3
"""Build the complete engineering requirements PDF from its current Markdown source.

Uses the bundled reportlab runtime. Companion-document links are relative to the
repository PDF output location; public citations remain clickable HTTPS links.
"""
from pathlib import Path
from html import escape
import re
import hashlib

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    NextPageTemplate, Table, TableStyle, Flowable, KeepTogether, CondPageBreak,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / '_docs/big-personality/engineering-requirements.md'
VERSION = re.search(r'\*\*Version:\*\*\s*([0-9.]+)', SOURCE.read_text()).group(1)
OUTPUT = ROOT / 'output/pdf/big-personality-engineering-requirements.pdf'
HERO = ROOT / '_docs/big-personality/assets/six-lenses-hero.png'
DEPS = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies'
FONTDIR = DEPS / 'native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype'
for name, filename in [('Body','LiberationSans-Regular.ttf'),('BodyBold','LiberationSans-Bold.ttf'),('BodyItalic','LiberationSans-Italic.ttf'),('BodyBoldItalic','LiberationSans-BoldItalic.ttf'),('Mono','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTDIR / filename)))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='BodyItalic', boldItalic='BodyBoldItalic')

INK = colors.HexColor('#172621')
MUTED = colors.HexColor('#526059')
GREEN = colors.HexColor('#245A47')
BLUE = colors.HexColor('#3558A0')
PAPER = colors.HexColor('#F5F2E9')
PALE = colors.HexColor('#EDF1ED')
RULE = colors.HexColor('#D3D8CE')
W,H = 612,792
MARGIN = 52
CW = W - 2*MARGIN

styles = {
    'body': ParagraphStyle('body',fontName='Body',fontSize=10.1,leading=14.3,textColor=INK,spaceAfter=8.2,splitLongWords=True,allowWidows=0,allowOrphans=0),
    'h2': ParagraphStyle('h2',fontName='BodyBold',fontSize=17.3,leading=21,textColor=GREEN,spaceBefore=15,spaceAfter=10,keepWithNext=True),
    'h3': ParagraphStyle('h3',fontName='BodyBold',fontSize=11.6,leading=15,textColor=INK,spaceBefore=10,spaceAfter=7,keepWithNext=True),
    'meta': ParagraphStyle('meta',fontName='Body',fontSize=9.6,leading=14,textColor=MUTED,spaceAfter=6),
    'cell': ParagraphStyle('cell',fontName='Body',fontSize=9,leading=12.3,textColor=INK,spaceAfter=0),
    'headcell': ParagraphStyle('headcell',fontName='BodyBold',fontSize=9,leading=12.3,textColor=colors.white,spaceAfter=0),
    'small': ParagraphStyle('small',fontName='Body',fontSize=8.5,leading=12,textColor=MUTED,spaceAfter=8),
    'bullet': ParagraphStyle('bullet',fontName='Body',fontSize=10.1,leading=14.3,textColor=INK,leftIndent=13,firstLineIndent=-12,spaceAfter=5.5,allowWidows=0,allowOrphans=0),
}

def clean(s):
    # Use portable ASCII hyphens, while preserving other supported punctuation.
    return s.translate(str.maketrans({'\u2011':'-','\u2013':'-','\u2014':' - ','\u2212':'-','\u2192':' -> '}))

TOKEN = re.compile(r'(\[[^\]]+\]\([^\)]+\)|`[^`]+`|\*\*.+?\*\*)')
def inline(text):
    text=clean(text)
    parts=[]
    for part in TOKEN.split(text):
        if part.startswith('[') and re.fullmatch(r'\[([^\]]+)\]\(([^\)]+)\)',part):
            m=re.fullmatch(r'\[([^\]]+)\]\(([^\)]+)\)',part)
            label,url=m.groups()
            if not re.match(r'https?://',url):
                url='../../_docs/big-personality/'+url
            parts.append('<link href="'+escape(url,quote=True)+'" color="#3558A0"><u>'+escape(label)+'</u></link>')
        elif part.startswith('`') and part.endswith('`'):
            parts.append('<font name="Mono" size="8.5">'+escape(part[1:-1])+'</font>')
        elif part.startswith('**') and part.endswith('**'):
            parts.append('<b>'+inline(part[2:-2])+'</b>')
        else:
            parts.append(escape(part))
    return ''.join(parts)

def para(text,kind='body'):
    return Paragraph(inline(text),styles[kind])

class Architecture(Flowable):
    """Equivalent static vector rendering of the source Mermaid flowchart."""
    def __init__(self):
        super().__init__(); self.width=CW; self.height=400
    def draw(self):
        c=self.canv
        def box(x,y,w,h,label,fill=PALE,fs=9):
            c.setFillColor(fill);c.setStrokeColor(RULE);c.roundRect(x,y,w,h,5,fill=1,stroke=1)
            p=Paragraph(label,ParagraphStyle('diagram',fontName='Body',fontSize=fs,leading=12,textColor=INK,alignment=1))
            pw,ph=p.wrap(w-12,h-8);p.drawOn(c,x+6,y+(h-ph)/2)
        def arrow(x1,y1,x2,y2):
            c.setStrokeColor(MUTED);c.setLineWidth(.8);c.line(x1,y1,x2,y2)
            import math
            a=math.atan2(y2-y1,x2-x1);r=4
            c.line(x2,y2,x2-r*math.cos(a-.45),y2-r*math.sin(a-.45))
            c.line(x2,y2,x2-r*math.cos(a+.45),y2-r*math.sin(a+.45))
        center=CW/2
        box(center-91,350,182,42,'Axum<br/>Public article + static assets')
        box(center-91,290,182,40,'Isolated browser document')
        box(CW-117,350,117,42,'Opt-in offline cache',PAPER)
        arrow(center,350,center,330)
        arrow(CW-58,350,CW-58,310);arrow(CW-58,310,center+91,310)
        box(center-91,230,182,40,'Questionnaire state controller')
        arrow(center,290,center,270)
        box(0,170,148,40,'IndexedDB via idb')
        box(center-66,170,132,40,'Pure scoring worker')
        arrow(center,230,center,210)
        arrow(center-91,250,74,250);arrow(74,250,74,210)
        box(center-91,110,182,40,'Versioned report model',PAPER)
        arrow(center,170,center,150)
        xs=[0,130,260,390]; widths=[118,118,118,118]
        labels=['Accessible<br/>report HTML','Local<br/>PDF worker','Explicit public<br/>summary serializer','Optional local<br/>inference worker']
        c.setStrokeColor(MUTED);c.line(center,110,center,91);c.line(59,91,449,91)
        for x,w,label in zip(xs,widths,labels):
            box(x,31,w,40,label);arrow(x+w/2,91,x+w/2,71)
        box(365,-20,143,34,'Labeled reflection suggestions',PAPER,8.4)
        arrow(449,31,449,14)

def page_background(c,doc):
    c.saveState()
    c.setFillColor(colors.white);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setStrokeColor(RULE);c.setLineWidth(.5);c.line(MARGIN,H-38,W-MARGIN,H-38)
    c.setFont('BodyBold',8);c.setFillColor(GREEN);c.drawString(MARGIN,H-29,'THE BIG SIX-SEVEN')
    c.setFont('Body',8);c.setFillColor(MUTED);c.drawRightString(W-MARGIN,H-29,f'ENGINEERING REQUIREMENTS  |  v{VERSION}')
    c.line(MARGIN,39,W-MARGIN,39)
    c.setFont('Body',8);c.drawString(MARGIN,26,'engmanager.xyz  /  Research and implementation specification')
    c.drawRightString(W-MARGIN,26,f'{doc.page:02d}')
    c.restoreState()

def cover(c,doc):
    c.saveState();c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(GREEN);c.setFont('BodyBold',10);c.drawString(MARGIN,H-63,'ENGMANAGER.XYZ  /  PRODUCT & ENGINEERING')
    c.setFillColor(INK);c.setFont('BodyBold',36);c.drawString(MARGIN,H-123,'The Big Six-Seven')
    c.setFont('Body',16.4);c.drawString(MARGIN,H-156,'Big Five personality + work interests + personal values')
    c.drawImage(ImageReader(str(HERO)),MARGIN,240,width=CW,height=CW*2/3,mask='auto')
    c.setFillColor(GREEN);c.setFont('BodyBold',19);c.drawString(MARGIN,199,'Engineering requirements')
    c.setFont('Body',12);c.setFillColor(MUTED);c.drawString(MARGIN,179,'Research, product design, architecture, and release gates')
    c.setStrokeColor(RULE);c.line(MARGIN,153,W-MARGIN,153)
    c.setFont('BodyBold',9);c.setFillColor(INK);c.drawString(MARGIN,132,f'VERSION {VERSION}');c.drawString(MARGIN+120,132,'19 SEPTEMBER 2026')
    p=Paragraph('A complete implementation specification for a local-first reflection experience for people in tech. Three established measures, 170 items, and private-by-default responses.',styles['meta'])
    p.wrap(CW,70);p.drawOn(c,MARGIN,82)
    c.setFont('Body',8.5);c.setFillColor(MUTED);c.drawString(MARGIN,42,'Specification and research package. Production assessment not yet implemented.')
    c.restoreState()

class Document(BaseDocTemplate):
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and hasattr(f,'section_key'):
            self.canv.bookmarkPage(f.section_key)
            self.canv.addOutlineEntry(f.getPlainText(),f.section_key,0,False)
            self.notify('TOCEntry',(0,f.getPlainText(),self.page,f.section_key))

def make_table(lines):
    rows=[]
    for line in lines:
        vals=[v.strip() for v in line.strip().strip('|').split('|')]
        if all(re.fullmatch(r':?-+:?',v) for v in vals):continue
        rows.append(vals)
    n=len(rows[0]); first=rows[0][0]
    if n==4 and first=='Module': ratios=[.13,.32,.23,.32]
    elif n==4 and first=='Step': ratios=[.13,.41,.24,.22]
    elif n==3 and first=='ID':ratios=[.14,.42,.44]
    elif n==3:ratios=[.20,.28,.52]
    else:ratios=[1/n]*n
    content=[[para(x,'headcell' if i==0 else 'cell') for x in row] for i,row in enumerate(rows)]
    pad = 3.5 if first == 'ID' else 8
    table=Table(content,colWidths=[CW*x for x in ratios],repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),GREEN),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(-1,-1),pad),('BOTTOMPADDING',(0,0),(-1,-1),pad),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),
        ('LINEBELOW',(0,0),(-1,0),.5,GREEN),('LINEBELOW',(0,1),(-1,-1),.35,RULE),
    ]))
    return table

def parse_body(lines):
    story=[];i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line:i+=1;continue
        if line.startswith('## '):
            title=line[3:]; key='section-'+str(len([x for x in story if hasattr(x,'section_key')])+1)
            story.append(CondPageBreak(130))
            p=para(title,'h2');p.section_key=key;story.append(p);i+=1
        elif line.startswith('### '):story.append(para(line[4:],'h3'));i+=1
        elif line.startswith('|'):
            table=[]
            while i<len(lines) and lines[i].strip().startswith('|'):table.append(lines[i]);i+=1
            built_table=make_table(table)
            story.append(KeepTogether([built_table]) if table[0].strip().startswith('| Token |') else built_table)
            story.append(Spacer(1,10))
        elif line.startswith('```'):
            code=[];i+=1
            while i<len(lines) and not lines[i].strip().startswith('```'):code.append(lines[i]);i+=1
            i+=1
            if 'flowchart' in '\n'.join(code):
                story.append(KeepTogether([Spacer(1,9),Architecture(),Spacer(1,28),para('Architecture: public assets enter an isolated browser document. Responses remain within local storage and scoring; every report output is derived from the same versioned model.','small')]))
            else:
                for row in code:story.append(para('`'+row+'`','small'))
        elif re.match(r'^(- |\d+\. )',line):
            m=re.match(r'^(- |\d+\. )(.*)',line)
            mark='•' if m[1]=='- ' else m[1].strip()
            story.append(Paragraph(escape(mark)+' '+inline(m[2]),styles['bullet']));i+=1
        else:
            block=[line];i+=1
            while i<len(lines) and lines[i].strip() and not re.match(r'^(#{1,3} |\||```|- |\d+\. )',lines[i].strip()):
                block.append(lines[i].strip());i+=1
            story.append(para(' '.join(block)))
    return story

def build():
    text=SOURCE.read_text(); lines=text.splitlines()
    start=next(i for i,l in enumerate(lines) if l.startswith('## 1.'))
    metadata=[l.strip() for l in lines[4:start] if l.strip()]
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    doc=Document(str(OUTPUT),pagesize=(W,H),leftMargin=MARGIN,rightMargin=MARGIN,topMargin=57,bottomMargin=55,title='The Big Six-Seven - Engineering requirements',author='engmanager.xyz',subject='Local-first Big Five personality, work interests, and personal values report experience',pageCompression=1)
    frame=Frame(MARGIN,55,CW,H-112,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
    doc.addPageTemplates([PageTemplate('cover',[frame],onPage=cover),PageTemplate('body',[frame],onPage=page_background)])
    story=[NextPageTemplate('body'),Spacer(1,1),PageBreak(),para('Document guide','h2')]
    for line in metadata:story.append(para(line,'meta'))
    story += [Spacer(1,12),para('Contents','h3')]
    toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc0',fontName='Body',fontSize=10,leading=18,textColor=INK,leftIndent=0,firstLineIndent=0,spaceBefore=0)]
    story.extend([toc,Spacer(1,15),para('Public citations are clickable. Links to companion research, question banks and assets resolve within the accompanying repository bundle. This PDF contains the complete engineering requirements; the separate questionnaire banks remain companion files.','small'),PageBreak()])
    story.extend(parse_body(lines[start:]))
    doc.multiBuild(story)
    print('PDF:',OUTPUT)
    print('Source SHA256:',hashlib.sha256(text.encode()).hexdigest())

if __name__=='__main__':build()
