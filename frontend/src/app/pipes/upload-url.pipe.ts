import { Pipe, PipeTransform } from '@angular/core';
import { resolveUploadUrl } from '../utils/upload-url.util';

@Pipe({ name: 'uploadUrl', standalone: true })
export class UploadUrlPipe implements PipeTransform {
  transform(url: string | null | undefined): string {
    return resolveUploadUrl(url);
  }
}
