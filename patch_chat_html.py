import codecs
path = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/chat.html'
with codecs.open(path, 'r', encoding='latin-1') as f:
    content = f.read()

content = content.replace('id="navCloudWorks"', 'id="navCloudWorks_hidden_pc"')

with codecs.open(path, 'w', encoding='latin-1') as f:
    f.write(content)
