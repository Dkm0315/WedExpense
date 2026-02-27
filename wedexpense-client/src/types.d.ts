import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

declare module 'react-icons/bs' {
  import { IconType } from 'react-icons';
  export const BsStars: IconType;
  export const BsPerson: IconType;
  export const BsBoxArrowRight: IconType;
  export const BsList: IconType;
  export const BsX: IconType;
  export const BsInboxes: IconType;
  export const BsPlus: IconType;
  export const BsPlusLg: IconType;
  export const BsSearch: IconType;
  export const BsCalendarHeart: IconType;
  export const BsCalendarEvent: IconType;
  export const BsCamera: IconType;
  export const BsCameraFill: IconType;
  export const BsUpload: IconType;
  export const BsFileEarmarkImage: IconType;
  export const BsTrash: IconType;
  export const BsPencil: IconType;
  export const BsReceipt: IconType;
  export const BsArrowLeft: IconType;
  export const BsGeoAlt: IconType;
  export const BsPeople: IconType;
  export const BsEnvelope: IconType;
  export const BsCheckCircle: IconType;
  export const BsExclamationTriangle: IconType;
  export const BsXCircle: IconType;
  export const BsCurrencyRupee: IconType;
  export const BsGraphUp: IconType;
  export const BsPieChart: IconType;
  export const BsCloudUpload: IconType;
  export const BsGear: IconType;
  export const BsPersonPlus: IconType;
  export const BsFileEarmark: IconType;
  export const BsPlusCircle: IconType;
  export const BsGlobe2: IconType;
  export const BsCheckCircleFill: IconType;
  export const BsExclamationCircle: IconType;
}

declare module 'react-icons' {
  import { SVGAttributes } from 'react';
  export interface IconBaseProps extends SVGAttributes<SVGElement> {
    size?: string | number;
    color?: string;
    title?: string;
  }
  export type IconType = (props: IconBaseProps) => JSX.Element;
}

declare const catalyst: {
  auth: {
    signIn: (containerId: string, options: any) => void;
    signOut: (redirectUrl: string) => void;
    generateAuthToken: () => Promise<{ access_token: string }>;
  };
};
