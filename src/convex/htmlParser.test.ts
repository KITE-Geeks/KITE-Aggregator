import { test } from 'node:test';
import { parseHtmlPage } from './htmlParser';
import { internalActionTester } from './_generated/server';

const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <div role="article">
        <div>
            <a href="/p/test-article-1" data-testid="post-preview-title">Last Week in AI #309 - Test Article</a>
        </div>
        <div>
            <a>This is a test subtitle for the first article</a>
        </div>
        <time datetime="2025-05-18T01:59:34.341Z">May 18</time>
    </div>
    <div role="article">
        <div>
            <a href="/p/test-article-2" data-testid="post-preview-title">Last Week in AI #308 - Another Test</a>
        </div>
        <div>
            <a>Second test article with a different subtitle</a>
        </div>
        <time>May 11</time>
    </div>
    <div role="article">
        <div>
            <a href="/p/test-article-3" data-testid="post-preview-title">Last Week in AI #307 - Duplicate Test</a>
        </div>
        <div>
            <a>This is a test subtitle that should be unique</a>
        </div>
        <time>May 4</time>
    </div>
</body>
</html>
`;

test('parseHtmlPage - Last Week in AI', async () => {
  const result = await internalActionTester(parseHtmlPage)({
    url: 'https://lastweekin.ai',
    html: testHtml
  });

  console.log('Parsing Results:', JSON.stringify(result, null, 2));
  
  // Basic validation
  if (!Array.isArray(result)) {
    throw new Error('Expected an array of articles');
  }
  
  if (result.length === 0) {
    throw new Error('No articles were parsed');
  }
  
  // Check for required fields
  result.forEach(article => {
    if (!article.title) throw new Error('Article is missing title');
    if (!article.content) throw new Error('Article is missing content');
    if (!article.originalAddress) throw new Error('Article is missing URL');
    if (typeof article.publicationDate !== 'number') {
      throw new Error('Article is missing or has invalid publication date');
    }
  });
  
  console.log('All tests passed!');
});
