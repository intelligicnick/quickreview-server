import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createWorker, OEM, PSM, type Page, type Worker } from 'tesseract.js';
import { linesFromPage, mergeOcrLines } from './scan-ocr-merge';
import { buildOcrVariants, sliceOcrTiles } from './scan-ocr-preprocess';
import type { UploadedImageFile } from './uploaded-file.type';

const FULL_IMAGE_PSM: PSM[] = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK, PSM.AUTO];
const TILE_PSM: PSM[] = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];

@Injectable()
export class ScanOcrService implements OnModuleDestroy {
  private readonly logger = new Logger(ScanOcrService.name);
  private worker: Worker | null = null;
  private workerReady: Promise<Worker> | null = null;

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.workerReady = null;
    }
  }

  async recognizeFiles(files: UploadedImageFile[]): Promise<string> {
    const worker = await this.getWorker();
    const chunks: string[] = [];
    for (const file of files) {
      const text = await this.recognizeBufferDeep(worker, file.buffer);
      if (text) chunks.push(text);
    }
    return chunks.join('\n\n---\n\n');
  }

  private async recognizeBufferDeep(worker: Worker, buffer: Buffer): Promise<string> {
    const variants = await buildOcrVariants(buffer);
    const lineBlocks: string[] = [];

    for (const image of variants) {
      for (const psm of FULL_IMAGE_PSM) {
        lineBlocks.push(await this.runPass(worker, image, psm));
      }
    }

    const tiles = await sliceOcrTiles(variants[0]);
    for (const tile of tiles) {
      for (const psm of TILE_PSM) {
        lineBlocks.push(await this.runPass(worker, tile, psm));
      }
    }

    const merged = mergeOcrLines(lineBlocks);
    if (!merged.trim()) {
      this.logger.warn('Deep OCR returned empty text after all passes');
    }
    return merged;
  }

  private async runPass(worker: Worker, image: Buffer, psm: PSM): Promise<string> {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
      user_defined_dpi: '300',
      preserve_interword_spaces: '1',
    });
    const { data } = await worker.recognize(image);
    return linesFromPage(data as Page).join('\n');
  }

  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;
    if (!this.workerReady) {
      this.workerReady = (async () => {
        const worker = await createWorker('eng+hin', OEM.LSTM_ONLY);
        this.worker = worker;
        this.logger.log('Tesseract OCR worker ready (eng+hin, multi-pass card mode)');
        return worker;
      })().catch((err) => {
        this.workerReady = null;
        throw err;
      });
    }
    return this.workerReady;
  }
}
