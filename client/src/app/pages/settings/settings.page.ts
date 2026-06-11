import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonToggle, IonButton, IonRange, IonIcon, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { settingsOutline, hardwareChipOutline, trashOutline, syncOutline, checkmarkCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonToggle, IonButton, IonRange, IonIcon, IonSelect, IonSelectOption
  ]
})
export class SettingsPage implements OnInit {
  // Application configurations from local storage or defaults
  delegate: 'GPU' | 'CPU' = 'GPU';
  maxHands = 2;
  minConfidence = 0.5;
  wasmMultiThreading = true;
  localWasmHosting = false;
  highFrameRate = true;

  constructor() {
    addIcons({ settingsOutline, hardwareChipOutline, trashOutline, syncOutline, checkmarkCircleOutline });
  }

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    const savedDelegate = localStorage.getItem('cfg_delegate');
    if (savedDelegate) this.delegate = savedDelegate as 'GPU' | 'CPU';

    const savedMaxHands = localStorage.getItem('cfg_maxHands');
    if (savedMaxHands) this.maxHands = parseInt(savedMaxHands, 10);

    const savedMinConfidence = localStorage.getItem('cfg_minConfidence');
    if (savedMinConfidence) this.minConfidence = parseFloat(savedMinConfidence);

    const savedWasm = localStorage.getItem('cfg_wasmMultiThreading');
    if (savedWasm) this.wasmMultiThreading = savedWasm === 'true';

    const savedLocalWasm = localStorage.getItem('cfg_localWasmHosting');
    if (savedLocalWasm) this.localWasmHosting = savedLocalWasm === 'true';
  }

  saveSettings() {
    localStorage.setItem('cfg_delegate', this.delegate);
    localStorage.setItem('cfg_maxHands', this.maxHands.toString());
    localStorage.setItem('cfg_minConfidence', this.minConfidence.toString());
    localStorage.setItem('cfg_wasmMultiThreading', this.wasmMultiThreading.toString());
    localStorage.setItem('cfg_localWasmHosting', this.localWasmHosting.toString());
  }

  onDelegateChange(event: any) {
    this.delegate = event.detail.value;
    this.saveSettings();
  }

  onMaxHandsChange(event: any) {
    this.maxHands = event.detail.value;
    this.saveSettings();
  }

  onConfidenceChange(event: any) {
    this.minConfidence = event.detail.value;
    this.saveSettings();
  }

  toggleWasmMultiThreading() {
    this.wasmMultiThreading = !this.wasmMultiThreading;
    this.saveSettings();
  }

  toggleLocalWasm() {
    this.localWasmHosting = !this.localWasmHosting;
    this.saveSettings();
  }

  toggleHighFrameRate() {
    this.highFrameRate = !this.highFrameRate;
  }

  clearAppCache() {
    localStorage.clear();
    this.delegate = 'GPU';
    this.maxHands = 2;
    this.minConfidence = 0.5;
    this.wasmMultiThreading = true;
    this.localWasmHosting = false;
    alert('Application settings reset to defaults.');
  }
}
