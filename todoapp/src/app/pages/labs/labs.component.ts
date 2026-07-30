import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-labs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './labs.component.html',
  styleUrl: './labs.component.css'
})
export class LabsComponent {
  welcome = 'Este es mi repaso de programación con Angular!';
  tasks = [
    'Instalar Angular',
    'crear proyecto',
    'ver lista en servidor'
  ]
}
