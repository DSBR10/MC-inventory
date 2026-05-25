export function formatAwsTags(

  tags: any[] | Record<string, string> | null | undefined = []

) {

  const formatted: Record<string, string> = {};

  // Handle null or undefined
  if (!tags) {
    return formatted;
  }

  // Handle object (key-value pairs)
  if (!Array.isArray(tags)) {
    return typeof tags === 'object' ? tags : formatted;
  }

  // Handle array of tags
  for (const tag of tags) {

    if (

      tag.Key &&
      tag.Value

    ) {

      formatted[tag.Key] =
        tag.Value;

    }

  }

  return formatted;

}