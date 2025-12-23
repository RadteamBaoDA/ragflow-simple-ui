import React, { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface OfficePreviewProps {
    url: string;
}

interface FormattedText {
    text: string;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    size?: number;
}

interface SlideData {
    index: number;
    imageUrls?: string[] | undefined;
    textContent: string;
    formattedTexts?: FormattedText[] | undefined;
    backgroundColor?: string | undefined;
}

// Simple in-memory cache for file content
const fileCache = new Map<string, ArrayBuffer>();

export const OfficePreview: React.FC<OfficePreviewProps> = ({ url }) => {
    const [content, setContent] = useState<React.ReactNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAndRender = async () => {
            try {
                setLoading(true);
                setError(null);

                // Determine file type from URL
                const urlPath = url.split('?')[0] || '';
                const extension = urlPath.split('.').pop()?.toLowerCase();

                // Check cache first
                if (fileCache.has(url)) {
                    console.log('Using cached file content');
                    const arrayBuffer = fileCache.get(url)!;
                    await processFile(arrayBuffer, extension);
                    setLoading(false);
                    return;
                }

                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to download file');
                const arrayBuffer = await response.arrayBuffer();

                // Cache the result
                fileCache.set(url, arrayBuffer);

                await processFile(arrayBuffer, extension);

            } catch (err) {
                console.error('Preview error:', err);
                setError('Failed to load document preview.');
            } finally {
                setLoading(false);
            }
        };

        const processFile = async (arrayBuffer: ArrayBuffer, extension: string | undefined) => {
            if (extension === 'docx') {
                await renderDocx(arrayBuffer);
            } else if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
                renderExcel(arrayBuffer);
            } else if (extension === 'pptx' || extension === 'ppt') {
                await renderPptx(arrayBuffer);
            } else {
                setError('Unsupported office file type for local preview.');
            }
        };

        fetchAndRender();
    }, [url]);

    const renderDocx = async (arrayBuffer: ArrayBuffer) => {
        try {
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setContent(
                <div className="w-full h-full overflow-auto">
                    <div
                        className="prose dark:prose-invert max-w-none p-8 bg-white dark:bg-gray-900 shadow-sm min-h-full"
                        dangerouslySetInnerHTML={{ __html: result.value }}
                    />
                </div>
            );
        } catch (e) {
            throw new Error('Failed to render DOCX');
        }
    };

    const renderExcel = (arrayBuffer: ArrayBuffer) => {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        if (workbook.SheetNames.length === 0) {
            throw new Error('No sheets found in Excel file');
        }
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            throw new Error('Invalid sheet name');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
            throw new Error('Sheet not found');
        }
        const html = XLSX.utils.sheet_to_html(worksheet, { id: 'excel-preview', editable: false });

        setContent(
            <div className="w-full h-full overflow-auto p-4 bg-white dark:bg-gray-900">
                <style>{`
                    #excel-preview { border-collapse: collapse; width: max-content; min-width: 100%; }
                    #excel-preview td, #excel-preview th { border: 1px solid #ddd; padding: 8px; white-space: nowrap; }
                    #excel-preview tr:nth-child(even) { background-color: #f2f2f2; }
                    .dark #excel-preview td, .dark #excel-preview th { border-color: #444; }
                    .dark #excel-preview tr:nth-child(even) { background-color: #1f2937; }
                `}</style>
                <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        );
    };

    const renderPptx = async (arrayBuffer: ArrayBuffer) => {
        try {
            const zip = await JSZip.loadAsync(arrayBuffer);
            const slides: SlideData[] = [];

            // Get all slide files
            const slideFiles = Object.keys(zip.files)
                .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
                .sort((a, b) => {
                    const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
                    const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
                    return numA - numB;
                });

            // Create a map of all images
            const imageMap = new Map<string, string>();
            const imageFiles = Object.keys(zip.files)
                .filter(name => name.match(/ppt\/media\/.*\.(png|jpg|jpeg|gif|svg)$/i));

            for (const filename of imageFiles) {
                const file = zip.files[filename];
                if (!file) continue;
                const blob = await file.async('blob');
                const url = URL.createObjectURL(blob);
                const imageName = filename.split('/').pop() || '';
                imageMap.set(imageName, url);
            }

            // Process each slide
            for (let i = 0; i < slideFiles.length; i++) {
                const slideFileName = slideFiles[i];
                if (!slideFileName) continue;
                const slideFile = zip.files[slideFileName];
                if (!slideFile) continue;
                const slideXml = await slideFile.async('text');

                // Parse slide relationships to map images
                const slideNum = slideFileName.match(/slide(\d+)\.xml$/)?.[1];
                if (!slideNum) continue;
                const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
                const relsFile = zip.files[relsPath];

                const slideImageUrls: string[] = [];
                if (relsFile) {
                    const relsXml = await relsFile.async('text');
                    // Extract image relationships
                    const imageRels = relsXml.matchAll(/<Relationship[^>]+Type="[^"]*image"[^>]+Target="\.\.\/media\/([^"]+)"/g);
                    for (const match of imageRels) {
                        const imageName = match[1];
                        if (!imageName) continue;
                        const imageUrl = imageMap.get(imageName);
                        if (imageUrl) {
                            slideImageUrls.push(imageUrl);
                        }
                    }
                }

                // Extract formatted text with styling
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(slideXml, 'text/xml');

                // Extract text with formatting
                const textRuns = xmlDoc.querySelectorAll('a\\:r, r');
                const formattedTexts: FormattedText[] = [];

                textRuns.forEach(run => {
                    const textNode = run.querySelector('a\\:t, t');
                    if (!textNode?.textContent) return;

                    const rPr = run.querySelector('a\\:rPr, rPr');
                    const formatting: FormattedText = { text: textNode.textContent };

                    if (rPr) {
                        formatting.bold = rPr.hasAttribute('b') || rPr.getAttribute('b') === '1';
                        formatting.italic = rPr.hasAttribute('i') || rPr.getAttribute('i') === '1';

                        const sz = rPr.getAttribute('sz');
                        if (sz) formatting.size = parseInt(sz) / 100; // Convert from points*100

                        // Try to extract color
                        const solidFill = rPr.querySelector('a\\:solidFill, solidFill');
                        const srgbClr = solidFill?.querySelector('a\\:srgbClr, srgbClr');
                        if (srgbClr) {
                            const color = srgbClr.getAttribute('val');
                            if (color) formatting.color = '#' + color;
                        }
                    }

                    formattedTexts.push(formatting);
                });

                // Extract background color
                let backgroundColor: string | undefined;
                const bgElement = xmlDoc.querySelector('p\\:bg, bg');
                if (bgElement) {
                    const solidFill = bgElement.querySelector('a\\:solidFill, solidFill');
                    const srgbClr = solidFill?.querySelector('a\\:srgbClr, srgbClr');
                    if (srgbClr) {
                        const color = srgbClr.getAttribute('val');
                        if (color) backgroundColor = '#' + color;
                    }
                }

                // Get plain text as fallback
                const textContent = slideXml
                    .match(/<a:t>([^<]+)<\/a:t>/g)
                    ?.map((match: string) => match.replace(/<\/?a:t>/g, ''))
                    .join('\n') || '';

                slides.push({
                    index: i,
                    imageUrls: slideImageUrls.length > 0 ? slideImageUrls : undefined,
                    textContent,
                    formattedTexts: formattedTexts.length > 0 ? formattedTexts : undefined,
                    backgroundColor
                });
            }

            if (slides.length === 0) {
                throw new Error('No slides found in presentation');
            }

            setContent(<PptxViewer slides={slides} />);
        } catch (e) {
            console.error('PPTX rendering error:', e);
            throw new Error('Failed to render PowerPoint presentation');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
                <AlertCircle className="w-12 h-12 mb-2" />
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-gray-100 dark:bg-gray-950 overflow-auto">
            {content}
        </div>
    );
};

// PowerPoint Viewer Component
const PptxViewer: React.FC<{ slides: SlideData[] }> = ({ slides }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => {
        setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
    };

    const previousSlide = () => {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const slide = slides[currentSlide];

    if (!slide) {
        return (
            <div className="flex items-center justify-center h-full text-red-500">
                <AlertCircle className="w-12 h-12 mb-2" />
                <p>Invalid slide index</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900">
            {/* Slide viewer */}
            <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div
                    className="max-w-4xl w-full rounded-lg shadow-lg p-8"
                    style={{
                        backgroundColor: slide.backgroundColor || undefined
                    }}
                >
                    {/* Render multiple images */}
                    {slide.imageUrls && slide.imageUrls.length > 0 && (
                        <div className="mb-6 space-y-4">
                            {slide.imageUrls.map((imageUrl, idx) => (
                                <img
                                    key={idx}
                                    src={imageUrl}
                                    alt={`Slide ${currentSlide + 1} - Image ${idx + 1}`}
                                    className="w-full h-auto rounded border border-gray-200 dark:border-gray-700"
                                />
                            ))}
                        </div>
                    )}

                    {/* Render formatted text if available */}
                    {slide.formattedTexts && slide.formattedTexts.length > 0 ? (
                        <div className="prose dark:prose-invert max-w-none">
                            <div className="space-y-2">
                                {slide.formattedTexts.map((formatted, idx) => (
                                    <span
                                        key={idx}
                                        style={{
                                            fontWeight: formatted.bold ? 'bold' : 'normal',
                                            fontStyle: formatted.italic ? 'italic' : 'normal',
                                            color: formatted.color || undefined,
                                            fontSize: formatted.size ? `${formatted.size}pt` : undefined,
                                        }}
                                        className="inline"
                                    >
                                        {formatted.text}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : slide.textContent ? (
                        <div className="prose dark:prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                                {slide.textContent}
                            </pre>
                        </div>
                    ) : null}

                    {!slide.imageUrls && !slide.formattedTexts && !slide.textContent && (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                            <AlertTriangle className="w-12 h-12 mr-2" />
                            <p>No content extracted for this slide</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation controls */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button
                        onClick={previousSlide}
                        disabled={currentSlide === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded bg-primary-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Previous
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Slide {currentSlide + 1} of {slides.length}
                        </span>

                        {/* Slide thumbnails */}
                        <div className="flex gap-1 ml-4">
                            {slides.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => goToSlide(index)}
                                    className={`w-3 h-3 rounded-full transition-colors ${index === currentSlide
                                        ? 'bg-primary-600'
                                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                                        }`}
                                    title={`Go to slide ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={nextSlide}
                        disabled={currentSlide === slides.length - 1}
                        className="flex items-center gap-2 px-4 py-2 rounded bg-primary-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                    >
                        Next
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

