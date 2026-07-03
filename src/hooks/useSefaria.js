import { useQuery, useQueryClient } from '@tanstack/react-query';

// --- Helper: Extract and Clean Text ---
// Replaces the original extractText logic to filter out mismatched Hebrew/English characters
const extractText = (data, expectedLang) => {
  if (!data?.versions || data.versions.length === 0) return [];
  const version = data.versions.find(v => v.language === expectedLang);
  if (!version || !version.text) return [];

  const rawArray = Array.isArray(version.text) ? version.text : [version.text];

  if (expectedLang === 'en') {
    return rawArray.map(line => {
      const containsHebrew = /[\u0590-\u05FF]/.test(line || '');
      return containsHebrew ? '' : line;
    });
  }
  return rawArray;
};

// --- Hook 1: Fetch the Table of Contents ---
export function useSefariaTOC(bookRef) {
  return useQuery({
    queryKey: ['sefaria-toc', bookRef],
    queryFn: async () => {
      const res = await fetch(`https://www.sefaria.org/api/index/${bookRef}`);
      if (!res.ok) throw new Error('Failed to fetch TOC');
      return res.json();
    },
    enabled: !!bookRef,
  });
}

// --- Hook 2: Fetch a Specific Text Section ---
export function useSefariaText(ref) {
  return useQuery({
    queryKey: ['sefaria-text', ref],
    queryFn: async () => {
      const encodedRef = encodeURIComponent(ref);
      
      // Fetch both versions simultaneously using Promise.all
      const [hebResp, engResp] = await Promise.all([
        fetch(`https://www.sefaria.org/api/v3/texts/${encodedRef}?version=source&context=0`),
        fetch(`https://www.sefaria.org/api/v3/texts/${encodedRef}?version=english|Sefaria%20Community%20Translation&context=0`)
      ]);

      if (!hebResp.ok || !engResp.ok) throw new Error('Failed to fetch text');

      const hebData = await hebResp.json();
      const engData = await engResp.json();

      return {
        he: extractText(hebData, 'he'),
        en: extractText(engData, 'en')
      };
    },
    enabled: !!ref,
  });
}

// --- Hook 3: Background Prefetcher ---
export function usePrefetchSefariaText() {
  const queryClient = useQueryClient();

  return (ref) => {
    if (!ref) return;
    queryClient.prefetchQuery({
      queryKey: ['sefaria-text', ref],
      queryFn: async () => {
        const encodedRef = encodeURIComponent(ref);
        const [hebResp, engResp] = await Promise.all([
          fetch(`https://www.sefaria.org/api/v3/texts/${encodedRef}?version=source&context=0`),
          fetch(`https://www.sefaria.org/api/v3/texts/${encodedRef}?version=english|Sefaria%20Community%20Translation&context=0`)
        ]);
        const hebData = await hebResp.json();
        const engData = await engResp.json();
        
        return {
          he: extractText(hebData, 'he'),
          en: extractText(engData, 'en')
        };
      },
      staleTime: 1000 * 60 * 60 * 24, // Keep prefetched data fresh
    });
  };
}