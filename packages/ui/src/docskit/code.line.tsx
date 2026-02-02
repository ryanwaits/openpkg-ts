import { type AnnotationHandler, InnerLine } from 'codehike/code';

export const line: AnnotationHandler = {
  name: 'line',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Line: ({ annotation, ...props }) => {
    return (
      <div
        style={{
          borderLeftColor: 'var(--openpkg-line-border, transparent)',
          backgroundColor: 'var(--openpkg-line-bg, transparent)',
        }}
        className="flex border-l-2 border-l-transparent background-color 0.3s ease"
      >
        <InnerLine merge={props} className="px-3 flex-1" />
      </div>
    );
  },
};
