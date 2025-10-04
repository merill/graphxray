export function findMatchingUrlTemplate(url, templates) {
  for (const template of templates) {
    const result = matchTemplateCandidate(url, template);
    if (result) {
      return result;
    }
  }
  return undefined;
}

function matchTemplateCandidate(url, template) {
  const urlSegments = url.split("/");
  const templateSegments = template.split("/");

  if (urlSegments.length !== templateSegments.length) {
    return;
  }

  const params = {};
  for (let i = 0; i < urlSegments.length; i++) {
    if (urlSegments[i] === templateSegments[i]) continue;

    // check if template segment is a param placeholder
    if (
      templateSegments[i].startsWith("[") &&
      templateSegments[i].endsWith("]")
    ) {
      const param = templateSegments[i].substring(
        1,
        templateSegments[i].length - 1
      );
      params[param] = urlSegments[i];
      continue;
    }

    return;
  }

  return {
    template,
    params,
  };
}
