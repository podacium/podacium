import React from "react";
import { CheckCircle } from "lucide-react";
import { isolateText } from "@/lib/i18n";

const bidi = (text: string) => {
  const hasRTL =
    /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
      text,
    );
  const hasLTR = /[A-Za-z0-9@.+ ]/.test(text);
  if (hasRTL && hasLTR) {
    return isolateText(text, "auto");
  }
  return text;
};

interface LegalContentSection {
  title?: string;
  intro?: string;
  items?: string[];
  note?: string;
}

interface LegalContentRendererProps {
  data: LegalContentSection[] | LegalContentSection | any;
  className?: string;
}

const LegalContentRenderer: React.FC<LegalContentRendererProps> = ({
  data,
  className = "",
}) => {
  const sections: LegalContentSection[] = Array.isArray(data) ? data : [data];
  if (sections.length === 0) return null;

  return (
    <div className={`space-y-5 ${className}`}>
      {sections.map((section, idx) => (
        <div key={idx} className="space-y-2">
          {section.title && (
            <h4 className="font-bold text-gray-900 dark:text-slate-100 text-start">
              {bidi(section.title)}
            </h4>
          )}
          {section.intro && !section.title && (
            <p className="text-gray-700 dark:text-slate-300 leading-relaxed text-start mb-2">
              {bidi(section.intro)}
            </p>
          )}
          {section.items && section.items.length > 0 && (
            <ul className="space-y-1.5">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-slate-300 leading-relaxed text-start">
                    {bidi(item)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {section.note && (
            <p className="text-sm text-gray-500 dark:text-slate-400 italic text-start mt-1">
              {bidi(section.note)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default LegalContentRenderer;
