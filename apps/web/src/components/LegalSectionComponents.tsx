import React from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  icon,
  badge,
}) => {
  const [numberPart, textPart] = (() => {
    const match = title.match(/^([\d.]+)\s+(.+)$/);
    if (match) {
      return [match[1], match[2]];
    }
    return [null, title];
  })();

  return (
    <div className="mb-8 text-start">
      <div className="flex items-center gap-3 mb-3 w-full">
        {icon && (
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex-shrink-0">
            {icon}
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 text-start">
          {numberPart && textPart ? (
            <>
              <span dir="ltr" className="inline-block">
                {numberPart}
              </span>{" "}
              {textPart}
            </>
          ) : (
            title
          )}
        </h2>
        {badge && (
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-full">
            {badge}
          </span>
        )}
      </div>
      {description && (
        <p className="text-gray-600 dark:text-slate-400 text-lg leading-relaxed max-w-4xl">
          {description}
        </p>
      )}
    </div>
  );
};

interface SubSectionProps {
  title: string;
  level?: 2 | 3 | 4;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const SubSection: React.FC<SubSectionProps> = ({
  title,
  level = 3,
  children,
  icon,
  className = "",
}) => {
  const [numberPart, textPart] = (() => {
    const match = title.match(/^([\d.]+)\s+(.+)$/);
    if (match) {
      return [match[1], match[2]];
    }
    return [null, title];
  })();

  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
  const headingClasses = {
    2: "text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4",
    3: "text-lg md:text-xl font-semibold text-gray-900 dark:text-slate-100 mb-3",
    4: "text-base md:text-lg font-semibold text-gray-800 dark:text-slate-200 mb-2",
  }[level];

  return (
    <div className={`mb-6 ${className} text-start`}>
      <div className="flex items-center gap-3 mb-3 w-full">
        {icon && (
          <div className="p-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg flex-shrink-0">
            {icon}
          </div>
        )}
        <HeadingTag className={`${headingClasses} w-full text-start`}>
          {numberPart && textPart ? (
            <>
              <span dir="ltr" className="inline-block">
                {numberPart}
              </span>{" "}
              {textPart}
            </>
          ) : (
            title
          )}
        </HeadingTag>
      </div>
      <div>{children}</div>
    </div>
  );
};

interface ContentBlockProps {
  children: React.ReactNode;
  className?: string;
  type?: "paragraph" | "list" | "definition" | "warning" | "info" | "important";
}

const ContentBlock: React.FC<ContentBlockProps> = ({
  children,
  className = "",
  type = "paragraph",
}) => {
  const baseClasses = {
    paragraph: `text-gray-700 dark:text-slate-300 leading-relaxed mb-4 text-start`,
    list: `space-y-2 mb-4 text-start`,
    definition: `bg-gray-50 dark:bg-slate-900/60 border-s-4 border-blue-500 ps-4 py-3 mb-4 rounded-e-lg`,
    warning: `bg-yellow-50 border-s-4 border-yellow-500 ps-4 py-3 mb-4 rounded-e-lg`,
    info: `bg-blue-50 dark:bg-blue-950/60 border-s-4 border-blue-500 ps-4 py-3 mb-4 rounded-e-lg`,
    important: `bg-purple-50 dark:bg-purple-950/60 border-s-4 border-purple-500 ps-4 py-3 mb-4 rounded-e-lg`,
  }[type];

  return <div className={`${baseClasses} ${className}`}>{children}</div>;
};

export { SectionHeader, SubSection, ContentBlock };
export type { SectionHeaderProps, SubSectionProps, ContentBlockProps };
