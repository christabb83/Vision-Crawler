import subprocess
import csv

def process_urls(file_path):
    with open(file_path, 'r') as file:
        reader = csv.reader(file)
        urls = [row[0] for row in reader]
    
    for url in urls:
        print(f"Processing {url}")
        result = subprocess.run(['node', 'vision_crawl.js', url], capture_output=True, text=True)
        print(result.stdout)

# Example usage
file_path = 'homepages.csv'  # Your list of URLs
process_urls(file_path)