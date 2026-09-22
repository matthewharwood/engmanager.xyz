"""Create the fictional visual sample. Requires reportlab and Pillow."""
from pathlib import Path
from io import BytesIO
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'examples/your-story-sample.pdf'
DATA=json.loads((ROOT/'examples/fictional-packet.json').read_text())
INK='#142532'; CREAM='#F7F2E8'; GOLD='#B18A48'; TEAL='#427E79'; MUTED='#58636B'
FONT=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf'),('Serif','DejaVuSerif.ttf')]:
    if (FONT/file).exists():pdfmetrics.registerFont(TTFont(name,str(FONT/file)))
    else:pdfmetrics.registerFont(pdfmetrics.Font(name,'Helvetica-Bold' if name=='Bold' else 'Times-Roman' if name=='Serif' else 'Helvetica','WinAnsiEncoding'))
W,H=595.276,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('Your Story - Fictional sample report')
c.setAuthor('Your Story research kit; AI-written fictional example')

def text(x,y,value,size=11,font='Body',color=INK):
    c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,value)
def para(x,y,value,width=507,size=11,color=INK,leading=None):
    style=ParagraphStyle('p',fontName='Body',fontSize=size,leading=leading or size*1.55,textColor=HexColor(color))
    p=Paragraph(value,style);w,h=p.wrap(width,700);p.drawOn(c,x,y-h);return y-h
def rule(y,color='#D8D1C4'):
    c.setStrokeColor(HexColor(color));c.setLineWidth(.6);c.line(44,y,W-44,y)
def page(n,dark=False):
    c.setFillColor(HexColor(INK if dark else CREAM));c.rect(0,0,W,H,fill=1,stroke=0)
    text(44,H-40,'YOUR STORY',10,'Bold',GOLD if dark else TEAL)
    text(338,H-40,'FICTIONAL EXAMPLE / NOT A USER PROFILE',7,'Body','#C8CAC7' if dark else MUTED)
    text(44,27,'AI-written reflection with optional symbolic storytelling',7,'Body','#C8CAC7' if dark else MUTED)
    text(W-55,27,str(n),9,'Body',GOLD if dark else MUTED)
def card(image,x,y,w,h):c.drawImage(str(ROOT/image),x,y,width=w,height=h,mask='auto')

page(1)
text(44,700,'Alex',64,'Serif')
text(47,656,'Your story, held lightly.',22,'Serif')
para(47,611,'Patterns you recognize.<br/>Experiences you chose to share.<br/>A little room for imagination.',242,12)
text(47,488,'YOUR CHOSEN SYMBOLS',8,'Bold',TEAL)
text(47,460,'Virgo  /  Horse',18,'Serif')
para(47,439,'Birthday conventions for this fictional example. Symbols are invitations to reflect, not personality evidence.',208,9,MUTED)
text(47,310,'THREE WAYS TO READ',8,'Bold',TEAL)
for y,title,caption in [(280,'Assessment','What the answers suggest'),(228,'Your experience','What you said about your life'),(176,'Symbol','A metaphor you may keep or leave')]:
    text(47,y,title,12,'Bold');text(47,y-19,caption,8.8,'Body',MUTED)
buf=BytesIO();Image.open(ROOT/'assets/tarot/v1/card-back.png').convert('RGB').save(buf,format='JPEG',quality=88);buf.seek(0)
c.drawImage(ImageReader(buf),309,161,width=242,height=363)
para(47,108,'An illustrated personal-story edition. All details and scores in this sample are invented for design review.',505,9,MUTED)
c.showPage()

page(2)
text(44,742,'Patterns, in context',30,'Serif')
para(44,711,'A profile can describe tendencies. Your circumstances help explain what is realistic to do with them.',507,11,MUTED)
scores={s['id']:s['mean'] for s in DATA['assessment']['scores']['big5']['domains']}
for i,(id,label) in enumerate([('O','Openness to experience'),('C','Conscientiousness'),('E','Extraversion'),('A','Agreeableness'),('N','Emotional reactivity')]):
    y=620-i*49;text(44,y+7,label,10,'Body');x=274;width=211
    c.setFillColor(HexColor('#E1DBCD'));c.roundRect(x,y,width,10,5,fill=1,stroke=0)
    c.setFillColor(HexColor(TEAL));c.roundRect(x,y,width*(scores[id]-1)/4,10,5,fill=1,stroke=0)
    text(503,y+1,f"{scores[id]:.1f}",11,'Bold')
text(274,363,'Raw means on a 1-5 response scale; not percentiles.',8,'Body',MUTED)
rule(342)
text(44,310,'Room to explore, room to care',18,'Serif')
y=para(44,284,'In this fictional profile, openness and agreeableness both average 4.0. Alex also chose communication and creativity as goals. Together, these give the report a useful starting point: exploring new ideas while paying attention to the people involved.',507,10.5)
y=para(44,y-19,'Alex reports clear expectations while growing up, and currently supports another adult. Those are lived circumstances, not conclusions about ancestry. They make a small, flexible experiment a more fitting invitation than a demanding personal overhaul.',507,10.5)
para(44,y-18,'The type-preference extension is unanswered in this example, so no four-letter label is assigned. The original color view remains an editorial summary of facets.',507,9,MUTED)
c.showPage()

page(3,True)
text(44,742,'Three cards. Three invitations.',26,'Serif',CREAM)
para(44,709,'A symbolic reflection. This example uses a fixed fictional spread; the app reference draws randomly and preserves the result.',507,10,'#CFD5D2')
items=DATA['story']['symbols']['tarot']['cards']
for i,item in enumerate(items):
    x=44+i*174
    text(x,647,f'0{i+1}  '+['PRESENT','QUESTION','NEXT STEP'][i],9,'Bold',GOLD)
    card(item['image']['localPath'],x,397,159,238.5)
    text(x,372,item['theme'],12,'Bold',CREAM)
    para(x,352,item['prompt'],157,9.5,'#CFD5D2')
rule(237,'#45515B')
text(44,207,'A thread you can choose to follow',17,'Serif',CREAM)
para(44,180,'Temperance offers a metaphor for making room for both curiosity and commitments. The Fool asks what beginning could be small enough to try. Eight of Pentacles brings the story back to practice: one brief creative session, with no promise about where it must lead.',507,10.5,'#E1E3DD')
para(44,89,'Keep a metaphor if it helps. Leave it if it does not. No card confirms a test result or predicts an event.',507,9,'#B6C2C1')
c.showPage()

page(4)
text(44,741,'A small next chapter',30,'Serif')
text(44,700,'15 MINUTES   /   NO COST   /   ONE EXPERIMENT',9,'Bold',TEAL)
text(44,647,'Make something unfinished.',22,'Serif')
y=para(44,613,'Choose an idea you are curious about. Give it fifteen minutes: sketch, write, or make a rough version. If coordinating with someone matters, agree on that small window first. You are creating a little space for a stated interest, not proving what kind of person you are.',507,12)
rule(y-28)
text(44,y-62,'Afterward, ask:',12,'Bold',TEAL)
para(44,y-86,'What felt engaging? What got in the way? Would I change the activity, the timing, or the support around it?',507,14)
text(44,276,'Why this invitation fits the supplied example',13,'Bold')
para(44,252,'Alex selected creativity and communication, a fifteen-minute time budget, no-cost suggestions, and one tiny next step. Those direct choices support this suggestion. The tarot supplies a visual motif; it does not supply evidence of likely success.',507,10.5)
para(44,128,'The report can also end with a story alone. There is no requirement to act, share personal context, or agree with the interpretation.',507,10,MUTED)
c.showPage()

page(5)
text(44,741,'Notes behind the story',29,'Serif')
y=711
sections=[
('Assessment','Synthetic IPIP-NEO-120 means: O 4.0, C 3.5, E 3.0, A 4.0, N 2.5. These describe positions on a 1-5 response scale, not norms or clinical findings. The supplied reference scorer produced them. Type-preference scores are unavailable because that module was not answered.'),
('Your experience','Every background detail on these pages comes from the fictional approved packet. Identity and birthplace are not used to infer traits. The sample does not represent the questionnaire creator or any real participant.'),
('Birthday symbols','Virgo uses a common tropical date-range approximation. Horse uses the Chinese calendar year and the Lunar New Year convention. The full birthday is absent from the exported packet. Boundary-sensitive Western dates remain unresolved in the reference implementation.'),
('Recorded spread','Draw ID: fictional-alex-spread-001. Deck: your-story-tarot-v1. Method: synthetic-fixture. Temperance, The Fool, and Eight of Pentacles, all upright. Card fronts are exact-label placeholders. Meanings are original reflective prompts.'),
('Sources and credits','IPIP items are public domain; IPIP-NEO-120 was developed by John A. Johnson (2014). The full kit retains the O*NET Mini Interest Profiler and TwIVI sources, instructions, and attribution; their scores are not illustrated in this sample. Birthday calendar references: Hong Kong Observatory. Cultural context research: Talhelm and colleagues; Gelfand and colleagues. Full linked sources are included in the kit.'),
('Limits','This is an AI-written design example, not a psychologist\'s assessment. No new type/color instrument, cultural score, or predictive tarot method has been validated by this project. The live website and Cloudflare configuration are not changed by the research kit.')]
for title,body in sections:
    text(44,y,title,12,'Bold',TEAL);y=para(44,y-14,body,507,9.3)-24
if y<55:raise RuntimeError('Methods page overflow')
c.save()
print(OUT)
